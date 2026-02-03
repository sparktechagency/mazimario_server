const cron = require('node-cron');
const ServiceRequest = require('../serviceRequest/ServiceRequest');
const LeadPurchase = require('../lead/LeadPurchase'); // If needed for reconciliation
// const postNotification = require('../../util/postNotification'); 

// 1. Expire Old Requests
const expireOldRequests = async () => {
    try {
        const now = new Date();
        // Expire pending requests older than 24 hours (if no providers purchased/assigned)
        // Adjust logic as needed. For now, using a placeholder expiration logic.
        // Assuming 'expiresAt' is set, or we default to 24h

        const expired = await ServiceRequest.updateMany(
            {
                status: { $in: ['PENDING', 'MATCHED'] },
                // expiresAt: { $lt: now } // If we set expiresAt
                createdAt: { $lt: new Date(now - 24 * 60 * 60 * 1000) } // 24h fallback
            },
            { status: 'EXPIRED' }
        );

        if (expired.modifiedCount > 0) {
            console.log(`Expired ${expired.modifiedCount} old service requests.`);
        }
    } catch (error) {
        console.error('Error in expireOldRequests cron:', error);
    }
};

// 2. Auto-Approve Completed Services (72 hours)
const autoApproveCompletedServices = async () => {
    try {
        const now = new Date();
        const seventyTwoHoursAgo = new Date(now - 72 * 60 * 60 * 1000);

        const approved = await ServiceRequest.updateMany(
            {
                status: 'COMPLETED',
                updatedAt: { $lt: seventyTwoHoursAgo }, // Assuming completedAt triggers update or we use completedAt field
                isReviewed: false
            },
            { status: 'APPROVED', autoApprovalAt: now }
        );

        if (approved.modifiedCount > 0) {
            console.log(`Auto-approved ${approved.modifiedCount} completed requests.`);
        }
    } catch (error) {
        console.error('Error in autoApproveCompletedServices cron:', error);
    }
};

const initCronJobs = () => {
    // Run every hour
    cron.schedule('0 * * * *', expireOldRequests);

    // Run every 6 hours
    cron.schedule('0 */6 * * *', autoApproveCompletedServices);

    console.log('Cron jobs initialized');
};

module.exports = initCronJobs;
