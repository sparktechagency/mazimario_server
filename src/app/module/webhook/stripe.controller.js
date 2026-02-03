const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const LeadPurchase = require('../lead/LeadPurchase');
const ServiceRequest = require('../serviceRequest/ServiceRequest');
const Provider = require('../provider/Provider');
const mongoose = require('mongoose');
const postNotification = require('../../../util/postNotification');

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Webhook received: ${event.type}`);

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;

            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

const handlePaymentSuccess = async (paymentIntent) => {
    const { providerId, serviceRequestId } = paymentIntent.metadata;

    if (!providerId || !serviceRequestId) {
        console.log('Metadata missing in payment intent', paymentIntent.id);
        return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Update LeadPurchase to COMPLETED
        const leadPurchase = await LeadPurchase.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntent.id },
            {
                status: 'COMPLETED',
                purchasedAt: new Date(),
                stripeChargeId: paymentIntent.latest_charge,
                $set: {
                    'metadata.paymentMethod': paymentIntent.payment_method
                }
            },
            { new: true, session }
        );

        if (!leadPurchase) {
            console.log('LeadPurchase not found for intent', paymentIntent.id);
            await session.abortTransaction();
            return;
        }

        // 2. Update ServiceRequest
        const request = await ServiceRequest.findByIdAndUpdate(
            serviceRequestId,
            {
                $push: {
                    purchasedBy: {
                        provider: providerId,
                        purchaseId: leadPurchase._id,
                        purchasedAt: new Date()
                    }
                }
            },
            { new: true, session }
        );

        // Update potential provider status to PAID
        await ServiceRequest.updateOne(
            { _id: serviceRequestId, 'potentialProviders.providerId': providerId },
            {
                $set: {
                    'potentialProviders.$.status': 'PAID',
                    'potentialProviders.$.paidAt': new Date(),
                    paymentHoldBy: null,
                    paymentHoldUntil: null
                }
            },
            { session }
        );

        // Update potential provider status to ACCEPTED (User simplified flow)
        await ServiceRequest.updateOne(
            { _id: serviceRequestId, 'potentialProviders.providerId': providerId },
            {
                $set: {
                    'potentialProviders.$.status': 'ACCEPTED', // Changed from PAID to ACCEPTED per user request
                    'potentialProviders.$.paidAt': new Date(),
                    paymentHoldBy: null,
                    paymentHoldUntil: null
                }
            },
            { session }
        );

        // Manually check and update status to IN_PROGRESS (ON GOING)
        // If the request was PENDING or PURCHASED, move it to IN_PROGRESS
        if (request.status === 'PENDING' || request.status === 'PURCHASED') {
            request.status = 'IN_PROGRESS';
            await request.save({ session });
        }

        // 3. Update Provider stats
        await Provider.findByIdAndUpdate(
            providerId,
            {
                $inc: {
                    totalLeadsPurchased: 1,
                    totalSpentOnLeads: paymentIntent.amount
                }
            },
            { session }
        );

        await session.commitTransaction();
        console.log("Payment successfully completed for provider:", providerId);

        // 4. Send notifications (Non-blocking)
        try {
            await postNotification(
                "Lead Purchased Success",
                `You have successfully purchased lead ${request.requestId}`,
                providerId, // User/Auth ID needs to be correct depending on implementation. Assuming providerId is sufficient or acts as AuthId helper
                { type: "LEAD_PURCHASE_SUCCESS", serviceRequestId }
            );
        } catch (e) { console.error("Notification failed", e); }

    } catch (error) {
        await session.abortTransaction();
        console.error('Error in handlePaymentSuccess:', error);
        throw error;
    } finally {
        session.endSession();
    }
};


const handleCheckoutSessionCompleted = async (session) => {
    // Session metadata contains the lead purchase details we put in createLeadCheckoutSession
    const { providerId, serviceRequestId, type } = session.metadata;

    if (type !== 'LEAD_PURCHASE') {
        // Ignore other session types if any
        return;
    }

    if (!providerId || !serviceRequestId) {
        console.log('Metadata missing in checkout session', session.id);
        return;
    }

    // We can also use payment_intent form session.payment_intent to store it if needed
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    // Use the existing handlePaymentSuccess logic by constructing a mock object or calling it directly if compatible
    // But since handlePaymentSuccess finds by stripePaymentIntentId and currently LeadPurchase has stripeCheckoutSessionId (and PI is pending/null)
    // we need specific logic here to find by session ID and update.

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        // 1. Update LeadPurchase to COMPLETED
        // Match by stripeCheckoutSessionId
        const leadPurchase = await LeadPurchase.findOneAndUpdate(
            { stripeCheckoutSessionId: session.id },
            {
                status: 'COMPLETED',
                purchasedAt: new Date(),
                stripePaymentIntentId: paymentIntentId,
                $set: {
                    'metadata.paymentStatus': session.payment_status,
                    'metadata.customerDetails': session.customer_details
                }
            },
            { new: true, session: dbSession }
        );

        if (!leadPurchase) {
            console.log('LeadPurchase not found for session', session.id);
            await dbSession.abortTransaction();
            return;
        }

        // 2. Update ServiceRequest
        // 2. Update ServiceRequest
        const request = await ServiceRequest.findByIdAndUpdate(
            serviceRequestId,
            {
                $push: {
                    purchasedBy: {
                        provider: providerId,
                        purchaseId: leadPurchase._id,
                        purchasedAt: new Date()
                    }
                }
            },
            { new: true, session: dbSession }
        );

        // Update potential provider status to ACCEPTED (User simplified flow)
        await ServiceRequest.updateOne(
            { _id: serviceRequestId, 'potentialProviders.providerId': providerId },
            {
                $set: {
                    'potentialProviders.$.status': 'ACCEPTED',
                    'potentialProviders.$.paidAt': new Date(),
                    paymentHoldBy: null,
                    paymentHoldUntil: null
                }
            },
            { session: dbSession }
        );

        if (request.status === 'PENDING' || request.status === 'PURCHASED') {
            request.status = 'IN_PROGRESS';
            await request.save({ session: dbSession });
        }

        // 3. Update Provider stats
        await Provider.findByIdAndUpdate(
            providerId,
            {
                $inc: {
                    totalLeadsPurchased: 1,
                    totalSpentOnLeads: session.amount_total
                }
            },
            { session: dbSession }
        );

        await dbSession.commitTransaction();
        console.log("Payment successfully completed for provider:", providerId);

        // 4. Send notifications (Non-blocking)
        try {
            await postNotification(
                "Lead Purchased Success",
                `You have successfully purchased lead ${request?.requestId}`,
                providerId,
                { type: "LEAD_PURCHASE_SUCCESS", serviceRequestId }
            );
        } catch (e) { console.error("Notification failed", e); }

    } catch (error) {
        await dbSession.abortTransaction();
        console.error('Error in handleCheckoutSessionCompleted:', error);
        throw error;
    } finally {
        dbSession.endSession();
    }
};

const handlePaymentFailed = async (paymentIntent) => {
    const { providerId, serviceRequestId } = paymentIntent.metadata;

    await LeadPurchase.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
            status: 'FAILED',
            metadata: {
                failureReason: paymentIntent.last_payment_error?.message
            }
        }
    );

    console.log(`Payment failed: ${paymentIntent.id}`);
};

module.exports = { handleStripeWebhook };
