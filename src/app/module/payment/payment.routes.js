const express = require("express");
const { PaymentUIController } = require("./payment.controller");
const router = express.Router();

router.get("/success", PaymentUIController.paymentSuccess);
router.get("/cancel", PaymentUIController.paymentCancel);

module.exports = router;
