# Phone Verification Process (Twilio)

This guide explains how to verify phone numbers for Users and Providers using the existing Twilio integration.

## 1. Prerequisites
Ensure your `.env` file has valid Twilio credentials:
```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

## 2. Verification Flow

### Step 1: Send Verification Code
When a user (User or Provider) wants to verify their phone number, the frontend should call this endpoint.

**Endpoint:** `POST /api/v1/phone-verification/send-code`
**Body:**
```json
{
  "phoneNumber": "+8801700000000",
  "userType": "USER"  // or "PROVIDER"
}
```
**What happens:**
- Backend checks if the phone number is valid.
- Sends a 5-digit code via SMS (using Twilio).
- Returns success message.

---

### Step 2: Verify the Code
The user enters the code received on their phone.

**Endpoint:** `POST /api/v1/phone-verification/verify-code`
**Body:**
```json
{
  "phoneNumber": "+8801700000000",
  "code": "12345"
}
```
**What happens:**
- Backend validates the code.
- If correct:
    - Updates `isPhoneVerified: true` in the database.
    - Updates `isActive: true`.
    - Returns an `accessToken` (logs the user in).

---

## 3. Special Case: Phone-Only Registration
If you want to allow users to sign up *only* with a phone number (no email initially).

**Endpoint:** `POST /api/v1/phone-verification/phone-only-register`
**Body:**
```json
{
  "phoneNumber": "+8801700000000"
}
```
**What happens:**
- Creates a new account placeholder.
- Sends verification SMS.
- User verifies code (Step 2) to complete registration.

---

## 4. Notes
- **Rate Limiting**: The system limits requests to 3 per hour per number to save costs.
- **Development Mode**: If you are in dev mode, check the console logs for the code instead of sending real SMS (to save credits).
