const express = require("express");
const { EmailVerificationController } = require("./emailVerification.controller");

const router = express.Router();

/**
 * Email Verification Routes
 * 
 * POST /email-verification/register - Register with email only
 * POST /email-verification/login - Request login OTP
 * POST /email-verification/verify-otp - Verify code and get JWT
 * POST /email-verification/resend-otp - Resend verification code
 * POST /email-verification/send-otp - Send generic OTP
 */

router
  .post("/register", EmailVerificationController.emailOnlyRegister)
  .post("/login", EmailVerificationController.emailLogin)
  .post("/verify-otp", EmailVerificationController.verifyEmailOtp)
  .post("/resend-otp", EmailVerificationController.resendEmailOtp)
  .post("/send-otp", EmailVerificationController.sendEmailOtp);

module.exports = router;
