# 📱 Quick Start Guide - Phone Verification

## 1️⃣ Setup Twilio (5 minutes)

1. **Create account**: [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. **Get credentials** from Console dashboard:
   - Account SID (starts with AC...)
   - Auth Token (click eye icon)
3. **Buy phone number**: Console → Phone Numbers → Buy a number (SMS-enabled)

## 2️⃣ Configure Environment

Add to `.env`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

## 3️⃣ Test Configuration

```bash
node test-twilio.js
```

## 4️⃣ API Endpoints

### Phone-Only Registration
```bash
curl -X POST http://localhost:3000/api/phone-verification/phone-only-register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

### Verify Code
```bash
curl -X POST http://localhost:3000/api/phone-verification/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "code": "12345"}'
```

## ✅ Done!

Full docs:
- **[PHONE_VERIFICATION_API.md](./PHONE_VERIFICATION_API.md)** - Complete API reference
- **[TWILIO_SETUP.md](./TWILIO_SETUP.md)** - Detailed setup guide
- **[Walkthrough](../../../../../.gemini/antigravity/brain/ccc18fe0-9799-4d42-b25e-f7883f185066/walkthrough.md)** - Implementation details
