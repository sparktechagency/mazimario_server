const { default: status } = require("http-status");
const Auth = require("../auth/Auth");
const User = require("../user/User");
const Provider = require("../provider/Provider");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const config = require("../../../config");
const { jwtHelpers } = require("../../../util/jwtHelpers");
const EmailHelpers = require("../../../util/emailHelpers");
const codeGenerator = require("../../../util/codeGenerator");
const validator = require("validator");

// In-memory rate limiting for emails
const rateLimitStore = new Map();

/**
 * Check rate limiting for email.
 * Rules:
 *  - Max 10 OTP sends per email per hour
 *  - At least 60 seconds between consecutive sends
 */
const checkRateLimit = (email) => {
  const now = Date.now();
  const limit = 10; // max OTP sends per hour
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const cooldownMs = 60 * 1000; // 60 seconds between sends

  if (!rateLimitStore.has(email)) {
    rateLimitStore.set(email, []);
  }

  const requests = rateLimitStore.get(email);
  const recentRequests = requests.filter((time) => now - time < windowMs);

  // Enforce cooldown: block if last request was less than 60s ago
  if (recentRequests.length > 0) {
    const lastRequest = recentRequests[recentRequests.length - 1];
    if (now - lastRequest < cooldownMs) {
      return false;
    }
  }

  // Enforce hourly cap
  if (recentRequests.length >= limit) {
    return false;
  }

  recentRequests.push(now);
  rateLimitStore.set(email, recentRequests);
  return true;
};

/**
 * Clear rate limit for an email (call after successful verification)
 */
const clearRateLimit = (email) => {
  rateLimitStore.delete(email);
};

/**
 * Helper to validate email strictly
 */
const isValidEmailAddress = (email) => {
  return email && validator.isEmail(email);
};

/**
 * Helper to send the OTP to an email address (used internally by other methods)
 */
const sendEmailOtpInternal = async (auth, createNewCode = true) => {
  if (createNewCode) {
    // Generate new OTP
    const { code: activationCode, expiredAt: activationCodeExpire } = codeGenerator(10); // 10 minutes expiry

    auth.activationCode = activationCode;
    auth.activationCodeExpire = activationCodeExpire;
    await auth.save();
  }

  const data = {
    user: auth.name || "",
    activationCode: auth.activationCode,
    activationCodeExpire: Math.round(
      (auth.activationCodeExpire - Date.now()) / (3 * 60 * 1000)
    ),
  };

  // Send via email helpers
  await EmailHelpers.sendEmailOtp(auth.email, data);

  return {
    message: "Email verification code sent successfully",
    email: auth.email,
    expiresIn: "3 minutes",
  };
};

/**
 * Send OTP (general entry point if we want to expose it directly)
 */
const sendEmailOtp = async (payload) => {
  validateFields(payload, ["email"]);

  const { email, userType = "USER", createAccount = false, name } = payload;
  const lowercaseEmail = email.toLowerCase();

  if (!isValidEmailAddress(lowercaseEmail)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email address format.");
  }

  if (!checkRateLimit(lowercaseEmail)) {
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

  let auth = await Auth.findOne({ email: lowercaseEmail });

  if (!auth && createAccount) {
    // Create new account
    auth = await Auth.create({
      email: lowercaseEmail,
      role: userType,
      name: name || `User ${Math.floor(Math.random() * 10000)}`,
      provider: "email_otp",
      isVerified: false,
      isActive: false,
    });

    // Create the associated profile
    if (userType === "USER") {
      await User.create({
        authId: auth._id,
        name: auth.name,
        email: lowercaseEmail,
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

  return await sendEmailOtpInternal(auth, true);
};

/**
 * Verify Email OTP and generate tokens
 */
const verifyEmailOtp = async (payload) => {
  validateFields(payload, ["email", "code"]);

  const { email, code } = payload;
  const lowercaseEmail = email.toLowerCase();

  if (!isValidEmailAddress(lowercaseEmail)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email address format.");
  }

  const auth = await Auth.findOne({ email: lowercaseEmail });
  if (!auth) throw new ApiError(status.NOT_FOUND, "Account does not exist!");

  if (!auth.activationCode) {
    throw new ApiError(
      status.NOT_FOUND,
      "No active verification code. Please request a new code."
    );
  }

  if (auth.activationCodeExpire && Date.now() > auth.activationCodeExpire) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Verification code has expired. Please request a new code."
    );
  }

  if (auth.activationCode !== code) {
    throw new ApiError(status.BAD_REQUEST, "Invalid verification code!");
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support.");
  }

  // Update auth status
  auth.isVerified = true;
  auth.isActive = true;
  auth.activationCode = undefined;
  auth.activationCodeExpire = undefined;
  await auth.save();

  // Clear rate limit after successful verification so the user can log in again freely
  clearRateLimit(lowercaseEmail);

  // Find user profile
  let profile;
  if (auth.role === "USER") {
    profile = await User.findOne({ authId: auth._id })
      .populate("authId", "-password")
      .lean();
  } else if (auth.role === "PROVIDER") {
    profile = await Provider.findOne({ authId: auth._id })
      .populate("authId", "-password")
      .lean();
  }

  const tokenPayload = {
    authId: auth._id,
    userId: profile ? profile._id : auth._id,
    email: auth.email,
    role: auth.role,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.secret,
    config.jwt.expires_in
  );

  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refresh_secret,
    config.jwt.refresh_expires_in
  );

  return {
    message: "Email verified successfully",
    email: lowercaseEmail,
    user: profile || {
      _id: auth._id,
      role: auth.role,
      name: auth.name,
      email: auth.email,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Resend OTP code
 */
const resendEmailOtp = async (payload) => {
  validateFields(payload, ["email"]);

  const { email } = payload;
  const lowercaseEmail = email.toLowerCase();

  if (!isValidEmailAddress(lowercaseEmail)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email address format.");
  }

  const auth = await Auth.findOne({ email: lowercaseEmail });

  if (!auth) {
    throw new ApiError(status.NOT_FOUND, "Account not found.");
  }

  if (auth.isActive && auth.isVerified) {
    // If we want to allow re-login via this method, we can. 
    // Standardizing on 'emailLogin' for logging in, but this is fine too.
  }

  if (!checkRateLimit(lowercaseEmail)) {
    throw new ApiError(
      status.TOO_MANY_REQUESTS,
      "Too many verification requests. Please try again later."
    );
  }

  return await sendEmailOtpInternal(auth, true);
};

/**
 * Email-only Registration Flow
 */
const emailOnlyRegister = async (payload) => {
  validateFields(payload, ["email"]);

  const { email, name } = payload;
  const lowercaseEmail = email.toLowerCase();

  if (!isValidEmailAddress(lowercaseEmail)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email address format.");
  }

  let auth = await Auth.findOne({ email: lowercaseEmail });

  if (auth) {
    if (auth.role && auth.role !== "USER") {
      throw new ApiError(
        status.BAD_REQUEST,
        `This email is registered with a different role (${auth.role}).`
      );
    }

    if (auth.isActive) {
      // Already registered and active - send OTP to log in
      return await emailLogin({ email: lowercaseEmail });
    }

    // Extant but inactive (OTP expired maybe) -> Resend it
    return await sendEmailOtp({
      email: lowercaseEmail,
      userType: auth.role,
      createAccount: false,
    });
  }

  // Create new account automatically
  return await sendEmailOtp({
    email: lowercaseEmail,
    name: name,
    userType: "USER",
    createAccount: true,
  });
};

/**
 * Email OTP Login
 */
const emailLogin = async (payload) => {
  validateFields(payload, ["email"]);

  const { email } = payload;
  const lowercaseEmail = email.toLowerCase();

  if (!isValidEmailAddress(lowercaseEmail)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email address format.");
  }

  if (!checkRateLimit(lowercaseEmail)) {
    throw new ApiError(
      status.TOO_MANY_REQUESTS,
      "Too many login verification requests. Please try again later."
    );
  }

  const auth = await Auth.findOne({ email: lowercaseEmail });

  if (!auth) {
    throw new ApiError(
      status.NOT_FOUND,
      "This email is not registered. Please sign up."
    );
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support.");
  }

  return await sendEmailOtpInternal(auth, true);
};

const EmailVerificationService = {
  sendEmailOtp,
  verifyEmailOtp,
  resendEmailOtp,
  emailOnlyRegister,
  emailLogin,
};

module.exports = { EmailVerificationService };
