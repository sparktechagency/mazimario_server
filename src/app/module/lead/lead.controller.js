const LeadService = require('./lead.service');
const sendResponse = require('../../../util/sendResponse');
const catchAsync = require('../../../util/catchAsync');


const getLeadPrice = catchAsync(async (req, res) => {
    const { requestId } = req.params;
    const result = await LeadService.getLeadPriceByRequestId(requestId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Lead price calculated successfully',
        data: result
    });
});

const purchaseLead = catchAsync(async (req, res) => {
    const { requestId } = req.params;
    const providerId = req.user.authId; // Assuming Auth middleware adds user
    const payload = req.body;

    const result = await LeadService.createLeadCheckoutSession(providerId, requestId, payload);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Lead checkout session created successfully',
        data: result
    });
});

module.exports = {
    getLeadPrice,
    purchaseLead
};
