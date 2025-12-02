const { PhoneVerificationService } = require("./phoneVerification.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

/**
 * Send verification code to phone number
 * POST /phone-verification/send-code
 * Body: { phoneNumber, userType?, createAccount? }
 */
const sendVerificationCode = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.sendVerificationCode(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verification code sent successfully",
    data: result,
  });
});

/**
 * Verify phone number with code
 * POST /phone-verification/verify-code
 * Body: { phoneNumber, code }
 */
const verifyPhoneCode = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.verifyPhoneCode(req.body);

  // Set refresh token in cookie
  const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
  res.cookie("refreshToken", result.refreshToken, cookieOptions);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Phone number verified successfully",
    data: result,
  });
});

/**
 * Resend verification code
 * POST /phone-verification/resend-code
 * Body: { phoneNumber }
 */
const resendVerificationCode = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.resendVerificationCode(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Verification code resent successfully",
    data: result,
  });
});

/**
 * Phone-only registration (for service requests)
 * POST /phone-verification/phone-only-register
 * Body: { phoneNumber }
 */
const phoneOnlyRegistration = catchAsync(async (req, res) => {
  const result = await PhoneVerificationService.phoneOnlyRegistration(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Registration successful. Please verify your phone number.",
    data: result,
  });
});

const PhoneVerificationController = {
  sendVerificationCode,
  verifyPhoneCode,
  resendVerificationCode,
  phoneOnlyRegistration,
};

module.exports = { PhoneVerificationController };