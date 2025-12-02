# 📱 Twilio Setup Guide

This guide will help you set up Twilio for SMS verification in the mazimario_server project.

---

## Step 1: Create Twilio Account

1. Go to **[https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)**
2. Click **"Sign up"** and fill in your details
3. Verify your email address
4. **Verify your phone number** (you'll receive a code via SMS)

---

## Step 2: Get Your Twilio Credentials

### Option A: Using Twilio Console

1. Log in to [Twilio Console](https://console.twilio.com/)
2. On the dashboard, you'll see:
   - **Account SID**: Starts with "AC..."
   - **Auth Token**: Click the eye icon to reveal it
3. **Copy both values** - you'll need them for the `.env` file

### Option B: Via Account Dashboard

1. Navigate to: **Console** → **Account** → **API keys & tokens**
2. Find your **Account SID** and **Auth Token**

---

## Step 3: Get a Twilio Phone Number

### Free Trial Accounts

1. Go to **Console** → **Phone Numbers** → **Manage** → **Buy a number**
2. Select your country (e.g., United States)
3. Filter by **Capabilities**: Check **SMS**
4. Click **Search**
5. Choose a number and click **Buy**
6. Confirm purchase (trial accounts get 1 free number)

### Verify Phone Number Capabilities

1. Go to **Active Numbers** in Twilio Console
2. Click on your purchased number
3. Verify **Messaging** is enabled
4. Note the **Phone Number** (format: +1XXXXXXXXXX)

---

## Step 4: Configure Environment Variables

1. Open your `.env` file in the project root
2. Add the following configuration:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_32_character_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

3. Replace with your actual values:
   - `TWILIO_ACCOUNT_SID`: From Step 2
   - `TWILIO_AUTH_TOKEN`: From Step 2
   - `TWILIO_PHONE_NUMBER`: From Step 3 (must include country code with +)

---

## Step 5: Test Your Configuration

### Quick Test Script

Create a file `test-twilio.js` in your project root:

```javascript
const twilio = require('twilio');
require('dotenv').config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function testTwilio() {
  try {
    const message = await client.messages.create({
      body: 'Test message from mazimario_server! 🎉',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: '+1234567890' // Replace with YOUR verified phone number
    });
    
    console.log('✅ Success! Message SID:', message.sid);
    console.log('📱 Check your phone for the SMS!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
  }
}

testTwilio();
```

Run the test:

```bash
node test-twilio.js
```

**Expected Output**:
```
✅ Success! Message SID: SM...
📱 Check your phone for the SMS!
```

---

## Step 6: Verify Phone Verification Endpoints

### Using cURL

```bash
# 1. Test phone-only registration
curl -X POST http://localhost:3000/api/phone-verification/phone-only-register \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"+1234567890\"}"

# Expected: 201 Created with "Verification code sent successfully"
# Check your phone for SMS
```

```bash
# 2. Verify the code (replace 12345 with actual code from SMS)
curl -X POST http://localhost:3000/api/phone-verification/verify-code \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"+1234567890\", \"code\": \"12345\"}"

# Expected: 200 OK with JWT tokens
```

---

## Troubleshooting

### Error: "Unable to create record: The 'To' number is not a valid phone number"

**Solution**: Ensure phone number is in E.164 format with country code:
- ✅ Correct: `+1234567890`
- ❌ Wrong: `1234567890`, `(123) 456-7890`

### Error: "Authenticate"

**Solution**: Check your credentials:
1. Verify `TWILIO_ACCOUNT_SID` starts with "AC"
2. Verify `TWILIO_AUTH_TOKEN` is correct (32 characters)
3. Make sure `.env` file is loaded (`require('dotenv').config()`)

### Error: "The 'From' number is not a valid phone number"

**Solution**: 
1. Verify `TWILIO_PHONE_NUMBER` matches your purchased number
2. Include the `+` prefix
3. Ensure the number is SMS-enabled in Twilio Console

### SMS Not Received

**Possible causes**:
1. **Trial Account Limitation**: Trial accounts can only send to verified numbers
   - Go to **Console** → **Phone Numbers** → **Verified Caller IDs**
   - Add and verify your test phone number
2. **Rate Limiting**: Check Twilio Console logs for delivery status
3. **Carrier Blocking**: Some carriers block automated messages

### Error: "Insufficient funds"

**Solution**: 
- Trial accounts have limited free credits
- Check balance: **Console** → **Billing** → **Account Balance**
- Add payment method to purchase more credits

---

## Trial Account Limitations

⚠️ **Important for Free Trial Accounts**:

1. **Can only send SMS to verified numbers**
   - Add numbers via: **Console** → **Phone Numbers** → **Verified Caller IDs**
2. **Limited credits** (~$15 USD)
   - Each SMS costs ~$0.0075
   - Monitor usage in Console
3. **Twilio branding** in messages
   - Trial messages include: "Sent from your Twilio trial account"
4. **Geographic restrictions**
   - Can only send to certain countries

**To remove limitations**: Upgrade to a paid account

---

## Production Checklist

Before deploying to production:

- [ ] Upgrade from trial to paid Twilio account
- [ ] Set up proper error monitoring (e.g., Sentry)
- [ ] Implement Redis for rate limiting (instead of in-memory)
- [ ] Set up SMS delivery tracking
- [ ] Configure message templates in Twilio
- [ ] Set up webhook for delivery status
- [ ] Enable 2FA for Twilio account
- [ ] Rotate Auth Token periodically
- [ ] Monitor SMS costs and set up alerts
- [ ] Test with multiple carriers and countries

---

## Pricing Information

### SMS Costs (USA)

- **Outbound SMS**: ~$0.0075 per message
- **Inbound SMS**: ~$0.0075 per message
- **Phone Number**: ~$1.15/month

### International SMS

Costs vary by country. Check: [Twilio Pricing](https://www.twilio.com/sms/pricing)

**Examples**:
- UK: ~$0.035 per SMS
- India: ~$0.008 per SMS
- Bangladesh: ~$0.04 per SMS

---

## Useful Links

- 📚 [Twilio Console](https://console.twilio.com/)
- 📖 [Twilio SMS Quickstart](https://www.twilio.com/docs/sms/quickstart/node)
- 💰 [Twilio Pricing](https://www.twilio.com/pricing)
- 🆘 [Twilio Support](https://support.twilio.com/)
- 📊 [Message Logs](https://console.twilio.com/us1/monitor/logs/sms)

---

## Security Best Practices

1. **Never commit `.env` file** to Git
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

2. **Rotate credentials regularly**
   - Generate new Auth Token every 3-6 months
   - Update in all environments

3. **Use environment-specific credentials**
   - Development: Trial account
   - Production: Paid account with separate credentials

4. **Monitor for unauthorized usage**
   - Set up usage alerts in Twilio Console
   - Review message logs regularly

5. **Implement proper rate limiting**
   - Use Redis in production
   - Set reasonable limits (e.g., 3 SMS per hour per number)

---

## Next Steps

After setup is complete:

1. ✅ Test all 4 phone verification endpoints
2. ✅ Verify JWT token generation
3. ✅ Test service request creation with phone-only auth
4. ✅ Monitor Twilio logs for any issues
5. ✅ Set up error handling for production

**Need help?** Check the [PHONE_VERIFICATION_API.md](./PHONE_VERIFICATION_API.md) for complete API documentation.
