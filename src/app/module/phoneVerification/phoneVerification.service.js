const { default: status } = require("http-status");
const Auth = require("../auth/Auth");
const User = require("../user/User");
const Provider = require("../provider/Provider");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const twilio = require("twilio");
const { createToken } = require("../../../util/jwtHelpers");
const config = require("../../../config");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
  const recentRequests = requests.filter((time) => now - time < windowMs);

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
    throw new ApiError(
      status.BAD_REQUEST,
      "Invalid phone number format. Use E.164 format (e.g., +1234567890)"
    );
  }

  if (!checkRateLimit(phoneNumber)) {
    throw new ApiError(
      status.TOO_MANY_REQUESTS,
      "Too many verification requests. Please try again later."
    );
  }

  if (!["USER", "PROVIDER"].includes(userType)) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Invalid userType. Must be USER or PROVIDER"
    );
  }

  try {
    let auth = await Auth.findOne({ phoneNumber });

    if (!auth && createAccount) {
      auth = await Auth.create({
        phoneNumber,
        role: userType,
        name: `User ${phoneNumber.slice(-4)}`,
        email: `${phoneNumber.replace("+", "")}@phone.temp`,
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
      throw new ApiError(
        status.NOT_FOUND,
        "Account not found. Please register first or use createAccount option."
      );
    }

    if (auth.role !== userType) {
      throw new ApiError(
        status.BAD_REQUEST,
        `This phone number is registered as ${auth.role}, not ${userType}`
      );
    }

    // [Twilio Verify] Send OTP — Twilio generates and delivers the code
    console.log(`📱 Sending SMS to ${phoneNumber}...`);
    await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phoneNumber, channel: "sms" });

    // [Bypassed] Old manual OTP storage — Twilio Verify manages code/expiry internally
    // auth.phoneVerificationCode = verificationCode;
    // auth.phoneVerificationExpires = verificationExpires;
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
    // Expose the real Twilio error message for debugging
    const twilioMessage = error?.message || "Failed to send verification code";
    console.error("Send verification code error:", error);
    throw new ApiError(
      status.INTERNAL_SERVER_ERROR,
      `SMS Error: ${twilioMessage}`
    );
  }
};

/**
 * Verify phone number with code
 */
const verifyPhoneCode = async (payload) => {
  validateFields(payload, ["phoneNumber", "code"]);

  const { phoneNumber, code } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Invalid phone number format. Use E.164 format (e.g., +1234567890)"
    );
  }

  const auth = await Auth.findOne({ phoneNumber });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  // [Twilio Verify] Check OTP — replaces manual DB code comparison
  const verifyResult = await twilioClient.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to: phoneNumber, code });

  if (verifyResult.status !== "approved") {
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code");
  }

  auth.isPhoneVerified = true;
  auth.isActive = true;
  auth.isVerified = true;
  // [Bypassed] Old OTP fields — no longer stored, so nothing to clear
  // auth.phoneVerificationCode = undefined;
  // auth.phoneVerificationExpires = undefined;
  await auth.save();

  if (auth.role === "USER") {
    await User.findOneAndUpdate(
      { authId: auth._id },
      { phoneNumber: phoneNumber },
      { new: true }
    );
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
    throw new ApiError(
      status.BAD_REQUEST,
      "Invalid phone number format. Use E.164 format (e.g., +1234567890)"
    );
  }

  const auth = await Auth.findOne({ phoneNumber });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  if (auth.isPhoneVerified) {
    throw new ApiError(status.BAD_REQUEST, "Phone number is already verified");
  }

  return await sendVerificationCode({
    phoneNumber,
    userType: auth.role,
    createAccount: false,
  });
};

/**
 * Phone-only registration
 */
const phoneOnlyRegistration = async (payload) => {
  validateFields(payload, ["phoneNumber"]);

  const { phoneNumber } = payload;

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Invalid phone number format. Use E.164 format (e.g., +1234567890)"
    );
  }

  let auth = await Auth.findOne({ phoneNumber });

  if (auth) {
    // Check if the existing user is a USER
    if (auth.role && auth.role !== "USER") {
      throw new ApiError(
        status.BAD_REQUEST,
        `This phone number is registered as ${
          auth.role
        }. Please use the ${auth.role.toLowerCase()} specific login.`
      );
    }

    if (auth.isPhoneVerified) {
      throw new ApiError(
        status.CONFLICT,
        "This phone number is already registered and verified. Please login."
      );
    }
    return await sendVerificationCode({
      phoneNumber,
      userType: auth.role,
      createAccount: false,
    });
  }

  return await sendVerificationCode({
    phoneNumber,
    userType: "USER",
    createAccount: true,
  });
};

const PhoneVerificationService = {
  sendVerificationCode,
  verifyPhoneCode,
  resendVerificationCode,
  phoneOnlyRegistration,
};

module.exports = { PhoneVerificationService };
