const express = require('express');
const LeadController = require('./lead.controller');
const auth = require('../../middleware/auth');
const { EnumUserRole } = require('../../../util/enum');

const router = express.Router();

// Get lead price (preview)
router.get(
    '/:requestId/price',
    auth(EnumUserRole.PROVIDER),
    LeadController.getLeadPrice
);

// Purchase lead
router.post(
    '/:requestId/purchase',
    auth(EnumUserRole.PROVIDER),
    LeadController.purchaseLead
);

module.exports = router;