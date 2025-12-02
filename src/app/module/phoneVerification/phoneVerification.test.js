/**
 * Phone Verification Unit Tests
 * 
 * Tests for phone-only registration and verification system
 * Run with: npm test (after setting up test environment)
 */

const { PhoneVerificationService } = require("../phoneVerification.service");
const Auth = require("../../auth/Auth");
const User = require("../../user/User");
const Provider = require("../../provider/Provider");

// Mock Twilio
jest.mock('twilio', () => {
    return jest.fn(() => ({
        messages: {
            create: jest.fn().mockResolvedValue({ sid: 'test-message-sid' })
        }
    }));
});

describe("Phone Verification Service", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("phoneOnlyRegistration", () => {

        test("should create new Auth and User records for valid phone number", async () => {
            const phoneNumber = "+1234567890";

            // Mock database calls
            Auth.findOne = jest.fn().mockResolvedValue(null);
            Auth.create = jest.fn().mockResolvedValue({
                _id: "auth123",
                phoneNumber,
                role: "USER",
                name: "User 7890",
                email: "1234567890@phone.temp",
                provider: "phone",
                isPhoneVerified: false,
                save: jest.fn().mockResolvedThis(),
            });
            User.create = jest.fn().mockResolvedValue({
                authId: "auth123",
                phoneNumber,
            });

            const result = await PhoneVerificationService.phoneOnlyRegistration({
                phoneNumber,
            });

            expect(Auth.create).toHaveBeenCalled();
            expect(User.create).toHaveBeenCalled();
            expect(result.message).toBe("Verification code sent successfully");
            expect(result.phoneNumber).toBe(phoneNumber);
        });

        test("should reject invalid phone number format", async () => {
            const invalidPhone = "1234567890"; // Missing +

            await expect(
                PhoneVerificationService.phoneOnlyRegistration({
                    phoneNumber: invalidPhone,
                })
            ).rejects.toThrow("Invalid phone number format");
        });

        test("should handle existing verified phone number", async () => {
            const phoneNumber = "+1234567890";

            Auth.findOne = jest.fn().mockResolvedValue({
                phoneNumber,
                isPhoneVerified: true,
            });

            await expect(
                PhoneVerificationService.phoneOnlyRegistration({
                    phoneNumber,
                })
            ).rejects.toThrow("already registered and verified");
        });

        test("should resend code for existing unverified phone", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                _id: "auth123",
                phoneNumber,
                role: "USER",
                isPhoneVerified: false,
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            const result = await PhoneVerificationService.phoneOnlyRegistration({
                phoneNumber,
            });

            expect(result.message).toBe("Verification code sent successfully");
        });
    });

    describe("sendVerificationCode", () => {

        test("should send code to existing user", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                _id: "auth123",
                phoneNumber,
                role: "USER",
                isPhoneVerified: false,
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            const result = await PhoneVerificationService.sendVerificationCode({
                phoneNumber,
                userType: "USER",
            });

            expect(mockAuth.save).toHaveBeenCalled();
            expect(mockAuth.phoneVerificationCode).toBeDefined();
            expect(mockAuth.phoneVerificationExpires).toBeDefined();
            expect(result.expiresIn).toBe("10 minutes");
        });

        test("should validate userType parameter", async () => {
            const phoneNumber = "+1234567890";

            await expect(
                PhoneVerificationService.sendVerificationCode({
                    phoneNumber,
                    userType: "INVALID",
                })
            ).rejects.toThrow("Invalid userType");
        });

        test("should check role mismatch", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                role: "PROVIDER",
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.sendVerificationCode({
                    phoneNumber,
                    userType: "USER",
                })
            ).rejects.toThrow("registered as PROVIDER");
        });

        test("should enforce rate limiting", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                role: "USER",
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            // Send 3 codes (should work)
            for (let i = 0; i < 3; i++) {
                await PhoneVerificationService.sendVerificationCode({
                    phoneNumber,
                    userType: "USER",
                });
            }

            // 4th attempt should fail
            await expect(
                PhoneVerificationService.sendVerificationCode({
                    phoneNumber,
                    userType: "USER",
                })
            ).rejects.toThrow("Too many verification requests");
        });
    });

    describe("verifyPhoneCode", () => {

        test("should verify correct code and return JWT", async () => {
            const phoneNumber = "+1234567890";
            const code = "12345";
            const mockAuth = {
                _id: "auth123",
                phoneNumber,
                role: "USER",
                email: "test@example.com",
                name: "Test User",
                phoneVerificationCode: code,
                phoneVerificationExpires: new Date(Date.now() + 5 * 60 * 1000),
                isPhoneVerified: false,
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);
            User.findOneAndUpdate = jest.fn().mockResolvedValue({});

            const result = await PhoneVerificationService.verifyPhoneCode({
                phoneNumber,
                code,
            });

            expect(mockAuth.isPhoneVerified).toBe(true);
            expect(mockAuth.isActive).toBe(true);
            expect(mockAuth.isVerified).toBe(true);
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.auth.isPhoneVerified).toBe(true);
        });

        test("should reject invalid code", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                phoneVerificationCode: "12345",
                phoneVerificationExpires: new Date(Date.now() + 5 * 60 * 1000),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.verifyPhoneCode({
                    phoneNumber,
                    code: "99999",
                })
            ).rejects.toThrow("Invalid verification code");
        });

        test("should reject expired code", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                phoneVerificationCode: "12345",
                phoneVerificationExpires: new Date(Date.now() - 1000), // Expired
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.verifyPhoneCode({
                    phoneNumber,
                    code: "12345",
                })
            ).rejects.toThrow("expired");
        });

        test("should handle missing verification code", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                phoneVerificationCode: null,
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.verifyPhoneCode({
                    phoneNumber,
                    code: "12345",
                })
            ).rejects.toThrow("No verification code found");
        });
    });

    describe("resendVerificationCode", () => {

        test("should resend code for unverified number", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                role: "USER",
                isPhoneVerified: false,
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            const result = await PhoneVerificationService.resendVerificationCode({
                phoneNumber,
            });

            expect(result.message).toBe("Verification code sent successfully");
        });

        test("should reject resend for already verified number", async () => {
            const phoneNumber = "+1234567890";
            const mockAuth = {
                phoneNumber,
                isPhoneVerified: true,
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.resendVerificationCode({
                    phoneNumber,
                })
            ).rejects.toThrow("already verified");
        });
    });

    describe("Phone Number Validation", () => {

        const validNumbers = [
            "+1234567890",
            "+442071234567",
            "+8801712345678",
            "+919876543210",
        ];

        const invalidNumbers = [
            "1234567890",        // Missing +
            "+1",                // Too short
            "+123456789012345678", // Too long
            "+(123) 456-7890",   // Special chars
            "+abc1234567890",    // Letters
        ];

        test.each(validNumbers)("should accept valid number: %s", async (phone) => {
            const mockAuth = {
                phoneNumber: phone,
                role: "USER",
                save: jest.fn().mockResolvedThis(),
            };

            Auth.findOne = jest.fn().mockResolvedValue(mockAuth);

            await expect(
                PhoneVerificationService.sendVerificationCode({
                    phoneNumber: phone,
                    userType: "USER",
                })
            ).resolves.toBeDefined();
        });

        test.each(invalidNumbers)("should reject invalid number: %s", async (phone) => {
            await expect(
                PhoneVerificationService.sendVerificationCode({
                    phoneNumber: phone,
                    userType: "USER",
                })
            ).rejects.toThrow("Invalid phone number format");
        });
    });
});
