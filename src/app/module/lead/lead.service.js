const LeadPurchase = require('./LeadPurchase');
const ServiceRequest = require('../serviceRequest/ServiceRequest');
const Provider = require('../provider/Provider');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Category = require('../category/Category');
const ApiError = require('../../../error/ApiError');


/**
 * Calculate the price for a lead based on category and multipliers
 * @param {Object} serviceRequest - The service request object or data
 * @returns {Promise<Object>} Pricing details
 */
const calculateLeadPrice = async (serviceRequest) => {
    // Get base price from Category
    // Handle both populated object and ID string
    const categoryId = serviceRequest.serviceCategory?._id || serviceRequest.serviceCategory;
    // console.log(serviceRequest)

    if (!categoryId) {
        throw new ApiError(400, "Service category is required for pricing");
    }

    const category = await Category.findById(categoryId);
    // The price in Category is stored in dollars (e.g., 129).
    // Stripe expects the amount in cents (e.g., 12900).
    const basePrice = category?.price || 5; // Default to $5 if category not found or no price set.
    console.log("basePrice", basePrice)
    // Calculate final price in cents
    const finalPrice = Math.round(basePrice * 100);

    return {
        amount: finalPrice,
        currency: 'USD',
        breakdown: {
            basePriceInDollars: basePrice,
            finalPriceInCents: finalPrice
        }
    };
};


const createLeadCheckoutSession = async (providerId, requestId, payload) => {
    const provider = await Provider.findOne({ authId: providerId });
    if (!provider) throw new ApiError(404, 'Provider not found');

    const request = await ServiceRequest.findOne({ requestId: requestId });

    // Validation
    if (!request) throw new ApiError(404, 'Service request not found');
    if (request.status === 'EXPIRED') throw new ApiError(400, 'Request expired');
    if (request.status === 'CANCELLED') throw new ApiError(400, 'Request cancelled');

    // Check already purchased
    const existing = await LeadPurchase.findOne({
        provider: provider._id,
        serviceRequest: request._id,
        status: { $in: ['PENDING', 'COMPLETED'] }
    });

    if (existing) {
        if (existing.status === 'COMPLETED') {
            throw new ApiError(409, 'You already purchased this lead');
        } else {
            // Check if existing session is still valid or just create new one?
            // For simplicity, we can return the existing session ID if available, 
            // but Stripe Sessions expire. Better to create new one or retrieve url.
            // Let's create a new one to be safe, or if we stored url we could return it.
        }
    }

    // Check max providers
    const purchaseCount = await LeadPurchase.countDocuments({
        serviceRequest: request._id,
        status: 'COMPLETED'
    });

    if (purchaseCount >= request.maxProviders) {
        throw new ApiError(410, 'Maximum providers reached');
    }

    // Calculate price
    const pricing = await calculateLeadPrice(request);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: pricing.currency,
                product_data: {
                    name: `Lead Purchase: ${request.requestId}`,
                    description: `Category: ${request.serviceCategory?.name || 'Service'}`,
                    metadata: {
                        requestId: request.requestId,
                        serviceRequestId: request._id.toString()
                    }
                },
                unit_amount: pricing.amount,
            },
            quantity: 1,
        }],
        mode: 'payment',
        success_url: process.env.STRIPE_SUCCESS_URL || 'http://10.10.20.52:6002/payment/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: process.env.STRIPE_CANCEL_URL || 'http://10.10.20.52:6002/payment/cancel',
        client_reference_id: providerId.toString(), // Store authId/providerId here 
        metadata: {
            providerId: provider._id.toString(),
            serviceRequestId: request._id.toString(),
            requestId: request.requestId,
            type: 'LEAD_PURCHASE'
        }
    });

    // Create LeadPurchase record (PENDING)
    const leadPurchase = await LeadPurchase.create({
        provider: provider._id,
        serviceRequest: request._id,
        amount: pricing.amount,
        currency: pricing.currency,
        stripeCheckoutSessionId: session.id,
        status: 'PENDING',
        metadata: {
            ...pricing.breakdown
        }
    });

    return {
        url: session.url,
        sessionId: session.id,
        leadPurchaseId: leadPurchase._id
    };
};



const getLeadPriceByRequestId = async (requestId) => {
    const serviceRequest = await ServiceRequest.findOne({ requestId });

    if (!serviceRequest) {
        throw new ApiError(404, 'Service request not found');
    }

    return calculateLeadPrice(serviceRequest);
};

module.exports = {
    calculateLeadPrice,
    createLeadCheckoutSession,
    getLeadPriceByRequestId
};
