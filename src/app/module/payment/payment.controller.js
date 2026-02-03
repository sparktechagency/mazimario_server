const catchAsync = require("../../../util/catchAsync");

const paymentSuccess = catchAsync(async (req, res) => {
    // Can add logic here to verifying session if needed, 
    // but simpler to just show success page as the webhook handles the logic.
    res.render("payment_success");
});

const paymentCancel = catchAsync(async (req, res) => {
    res.render("payment_cancel");
});

const PaymentUIController = {
    paymentSuccess,
    paymentCancel,
};

module.exports = { PaymentUIController };
