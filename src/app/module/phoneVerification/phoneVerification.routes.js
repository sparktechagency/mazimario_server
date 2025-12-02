const express = require("express");
const { PhoneVerificationController } = require("./phoneVerification.controller");

const router = express.Router();

/**
 * Phone Verification Routes
 * 
 * POST /phone-verification/phone-only-register - Register with phone number only (for service requests)
 * POST /phone-verification/send-code - Send verification code
 * POST /phone-verification/verify-code - Verify code and get JWT
 * POST /phone-verification/resend-code - Resend verification code
 */

router
  .post("/phone-only-register", PhoneVerificationController.phoneOnlyRegistration)
  .post("/send-code", PhoneVerificationController.sendVerificationCode)
  .post("/verify-code", PhoneVerificationController.verifyPhoneCode)
  .post("/resend-code", PhoneVerificationController.resendVerificationCode);

module.exports = router;