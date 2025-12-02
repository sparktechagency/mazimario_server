const { default: status } = require("http-status");
const Auth = require("../auth/Auth");
const User = require("../user/User");
const Provider = require("../provider/Provider");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const twilio = require('twilio');
const { createToken } = require("../../../util/jwtHelpers");
const config = require("../../../config");

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// In-memory rate limiting (consider using Redis in production)
const rateLimitStore = new Map();

/**
 * Validate phone number format (E.164)
 */
const isValidPhoneNumber = (phoneNumber) => {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
};

/**
 * Check rate limiting for phone number
 */
const checkRateLimit = (phoneNumber) => {
  const now = Date.now();
  const limit = 3;
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (!rateLimitStore.has(phoneNumber)) {
    rateLimitStore.set(phoneNumber, []);
  }

  const requests = rateLimitStore.get(phoneNumber);
  const recentRequests = requests.filter(time => now - time < windowMs);

  if (recentRequests.length >= limit) {
    return false;
  }

  recentRequests.push(now);
  rateLimitStore.set(phoneNumber, recentRequests);
  return true;
};

/**
 * Generate random 5-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

/**
 * Send verification code to phone number
 */
const sendVerificationCode = async (payload) => {
  validateFields(payload, ["phoneNumber"]);

  const { phoneNumber, userType = "USER", createAccount = false } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid phone number format. Use E.164 format (e.g., +1234567890)");
  }

  if (!checkRateLimit(phoneNumber)) {
    throw new ApiError(status.TOO_MANY_REQUESTS, "Too many verification requests. Please try again later.");
  }

  if (!["USER", "PROVIDER"].includes(userType)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid userType. Must be USER or PROVIDER");
  }

  try {
    let auth = await Auth.findOne({ phoneNumber });

    if (!auth && createAccount) {
      auth = await Auth.create({
        phoneNumber,
        role: userType,
        name: `User ${phoneNumber.slice(-4)}`,
        email: `${phoneNumber.replace('+', '')}@phone.temp`,
        provider: "phone",
        isVerified: false,
        isPhoneVerified: false,
        isActive: false,
      });

      if (userType === "USER") {
        await User.create({
          authId: auth._id,
          name: auth.name,
          email: auth.email,
          phoneNumber: phoneNumber,
        });
      } else if (userType === "PROVIDER") {
        await Provider.create({
          authId: auth._id,
          contactPerson: auth.name,
        });
      }
    }

    if (!auth) {
      throw new ApiError(status.NOT_FOUND, "Account not found. Please register first or use createAccount option.");
    }

    if (auth.role !== userType) {
      throw new ApiError(status.BAD_REQUEST, `This phone number is registered as ${auth.role}, not ${userType}`);
    }

    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Bangladesh dev mode bypass
    const isBangladesh = phoneNumber.startsWith('+880') || phoneNumber.startsWith('+88');
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_SMS_BYPASS === 'true';

    if (isBangladesh && isDevelopment) {
      console.log("\n🇧🇩 ========== BANGLADESH DEV MODE ==========");
      console.log("📱 Phone Number:", phoneNumber);
      console.log("🔢 Verification Code:", verificationCode);
      console.log("⏰ Expires:", verificationExpires.toLocaleString());
      console.log("ℹ️  SMS sending bypassed in development mode");
      console.log("💡 To enable real SMS, see BANGLADESH_SMS_SOLUTIONS.md");
      console.log("============================================\n");
    } else {
      await twilioClient.messages.create({
        body: `Your mazimario verification code is: ${verificationCode}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    }

    auth.phoneVerificationCode = verificationCode;
    auth.phoneVerificationExpires = verificationExpires;
    auth.isPhoneVerified = false;
    await auth.save();

    return {
      message: "Verification code sent successfully",
      phoneNumber: phoneNumber,
      expiresIn: "10 minutes",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Send verification code error:", error);
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to send verification code");
  }
};

/**
 * Verify phone number with code
 */
const verifyPhoneCode = async (payload) => {
  validateFields(payload, ["phoneNumber", "code"]);

  const { phoneNumber, code } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid phone number format. Use E.164 format (e.g., +1234567890)");
  }

  const auth = await Auth.findOne({ phoneNumber });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  if (!auth.phoneVerificationCode) {
    throw new ApiError(status.BAD_REQUEST, "No verification code found. Please request a new code.");
  }

  if (auth.phoneVerificationExpires < new Date()) {
    throw new ApiError(status.BAD_REQUEST, "Verification code has expired. Please request a new code.");
  }

  if (auth.phoneVerificationCode !== code) {
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code");
  }

  auth.isPhoneVerified = true;
  auth.isActive = true;
  auth.isVerified = true;
  auth.phoneVerificationCode = undefined;
  auth.phoneVerificationExpires = undefined;
  await auth.save();

  if (auth.role === "USER") {
    await User.findOneAndUpdate({ authId: auth._id }, { phoneNumber: phoneNumber }, { new: true });
  }

  const accessToken = createToken(
    { _id: auth._id, role: auth.role, email: auth.email },
    config.jwt.jwt_secret,
    config.jwt.jwt_expire_in
  );

  const refreshToken = createToken(
    { _id: auth._id, role: auth.role, email: auth.email },
    config.jwt.jwt_refresh_secret,
    config.jwt.jwt_refresh_expire_in
  );

  return {
    message: "Phone number verified successfully",
    phoneNumber: phoneNumber,
    auth: {
      _id: auth._id,
      role: auth.role,
      name: auth.name,
      email: auth.email,
      phoneNumber: auth.phoneNumber,
      isPhoneVerified: auth.isPhoneVerified,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Resend verification code
 */
const resendVerificationCode = async (payload) => {
  validateFields(payload, ["phoneNumber"]);

  const { phoneNumber } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid phone number format. Use E.164 format (e.g., +1234567890)");
  }

  const auth = await Auth.findOne({ phoneNumber });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  if (auth.isPhoneVerified) {
    throw new ApiError(status.BAD_REQUEST, "Phone number is already verified");
  }

  return await sendVerificationCode({ phoneNumber, userType: auth.role, createAccount: false });
};

/**
 * Phone-only registration
 */
const phoneOnlyRegistration = async (payload) => {
  validateFields(payload, ["phoneNumber"]);

  const { phoneNumber } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid phone number format. Use E.164 format (e.g., +1234567890)");
  }

  let auth = await Auth.findOne({ phoneNumber });

  if (auth) {
    if (auth.isPhoneVerified) {
      throw new ApiError(status.CONFLICT, "This phone number is already registered and verified. Please login.");
    }
    return await sendVerificationCode({ phoneNumber, userType: auth.role, createAccount: false });
  }

  return await sendVerificationCode({ phoneNumber, userType: "USER", createAccount: true });
};

const PhoneVerificationService = {
  sendVerificationCode,
  verifyPhoneCode,
  resendVerificationCode,
  phoneOnlyRegistration,
};

module.exports = { PhoneVerificationService };