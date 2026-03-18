const { EmailVerificationService } = require("./emailVerification.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

/**
 * Register with email / get OTP
 * POST /email-verification/register
 * Body: { email, name? }
 */
const emailOnlyRegister = catchAsync(async (req, res) => {
  const result = await EmailVerificationService.emailOnlyRegister(req.body);
  sendResponse(res, {
    statusCode: 201, // Or 200 depending on flow
    success: true,
    message: result.message,
    data: result,
  });
});

/**
 * Login with email (request OTP)
 * POST /email-verification/login
 * Body: { email }
 */
const emailLogin = catchAsync(async (req, res) => {
  const result = await EmailVerificationService.emailLogin(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login code sent successfully",
    data: result,
  });
});

/**
 * Verify OTP code
 * POST /email-verification/verify-otp
 * Body: { email, code }
 */
const verifyEmailOtp = catchAsync(async (req, res) => {
  const result = await EmailVerificationService.verifyEmailOtp(req.body);

  // Set refresh token in cookie
  const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // Matches standard 30d lifetime
  };
  res.cookie("refreshToken", result.refreshToken, cookieOptions);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Email verified successfully",
    data: result,
  });
});

/**
 * Resend OTP
 * POST /email-verification/resend-otp
 * Body: { email }
 */
const resendEmailOtp = catchAsync(async (req, res) => {
  const result = await EmailVerificationService.resendEmailOtp(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verification code resent successfully",
    data: result,
  });
});

/**
 * Send generic OTP
 * POST /email-verification/send-otp
 * Body: { email, name?, userType?, createAccount? }
 */
const sendEmailOtp = catchAsync(async (req, res) => {
  const result = await EmailVerificationService.sendEmailOtp(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verification code sent successfully",
    data: result,
  });
});

const EmailVerificationController = {
  emailOnlyRegister,
  emailLogin,
  verifyEmailOtp,
  resendEmailOtp,
  sendEmailOtp,
};

module.exports = { EmailVerificationController };
