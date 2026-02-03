const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const LeadPurchaseSchema = new Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    serviceRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceRequest',
        required: true
    },
    amount: {
        type: Number,
        required: true // Amount in cents
    },
    currency: {
        type: String,
        default: 'USD'
    },
    stripePaymentIntentId: {
        type: String,
        // required: true, // No longer required on creation for Checkout Session
        // unique: true 
    },
    stripeCheckoutSessionId: {
        type: String,
        unique: true
    },
    stripeChargeId: String,
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
        default: 'PENDING'
    },
    purchasedAt: Date,
    refundedAt: Date,
    refundReason: String,
    refundAmount: Number,
    detailsViewedAt: Date, // First time provider viewed full details
    metadata: Schema.Types.Mixed,
}, {
    timestamps: true
});

// Indexes
LeadPurchaseSchema.index({ provider: 1, serviceRequest: 1 });
LeadPurchaseSchema.index({ stripePaymentIntentId: 1 }, { unique: true, sparse: true });
LeadPurchaseSchema.index({ stripeCheckoutSessionId: 1 }, { unique: true });
LeadPurchaseSchema.index({ status: 1, createdAt: -1 });

module.exports = model('LeadPurchase', LeadPurchaseSchema);