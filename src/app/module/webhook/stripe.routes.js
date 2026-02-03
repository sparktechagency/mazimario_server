const express = require('express');
const { handleStripeWebhook } = require('./stripe.controller');

const router = express.Router();

// Match the path used in app.js or define here. 
// Since app.js likely mounts it at a specific path, we just use '/'
router.post(
    '/',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
);

module.exports = router;
