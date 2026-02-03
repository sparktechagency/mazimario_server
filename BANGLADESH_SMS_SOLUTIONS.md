# 🇧🇩 SMS Solutions for Bangladesh

## The Problem

Twilio has **geographic restrictions** for SMS delivery to Bangladesh. This affects:
- ✅ **Paid accounts**: May work with additional verification
- ❌ **Trial accounts**: Often blocked or restricted
- ⚠️ **Carrier restrictions**: Some Bangladeshi carriers block international SMS

---

## Solution 1: SSL Wireless (Recommended for Bangladesh) ✅

**SSL Wireless** is a Bangladeshi SMS gateway provider that works reliably in Bangladesh.

### Setup SSL Wireless

1. **Create Account**: [https://sslwireless.com/](https://sslwireless.com/)
2. **Get API Credentials**
3. **Purchase SMS credits** (cheaper than Twilio for BD)

### Installation

```bash
npm install axios
```

### SSL Wireless Integration

Create a new file: `src/util/smsService.js`

```javascript
const axios = require('axios');

/**
 * Send SMS using SSL Wireless (Bangladesh)
 */
const sendSMSViaSSL = async (phoneNumber, message) => {
  try {
    const response = await axios.post('https://smsplus.sslwireless.com/api/v3/send-sms/dynamic', {
      api_token: process.env.SSL_SMS_API_TOKEN,
      sid: process.env.SSL_SMS_SID,
      sms: message,
      msisdn: phoneNumber.replace('+88', ''), // Remove +88 for Bangladesh
      csms_id: Date.now().toString()
    });

    return response.data;
  } catch (error) {
    // console.error('SSL Wireless error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send SMS using Twilio (International)
 */
const sendSMSViaTwilio = async (phoneNumber, message) => {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  return await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber
  });
};

/**
 * Send SMS using appropriate provider based on country code
 */
const sendSMS = async (phoneNumber, message) => {
  // Bangladesh numbers start with +880
  if (phoneNumber.startsWith('+880')) {
    return await sendSMSViaSSL(phoneNumber, message);
  } else {
    return await sendSMSViaTwilio(phoneNumber, message);
  }
};

module.exports = { sendSMS, sendSMSViaSSL, sendSMSViaTwilio };
```

### Update .env

```env
# SSL Wireless (Bangladesh)
SSL_SMS_API_TOKEN=your_ssl_api_token
SSL_SMS_SID=your_ssl_sid

# Twilio (International)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Update phoneVerification.service.js

Replace the Twilio SMS sending code:

```javascript
const { sendSMS } = require("../../../util/smsService");

// Instead of:
// await twilioClient.messages.create({...});

// Use:
await sendSMS(phoneNumber, `Your mazimario verification code is: ${verificationCode}. Valid for 10 minutes.`);
```

---

## Solution 2: Use Alternative Bangladeshi SMS Providers

### A. **Carnival Internet** (Popular in Bangladesh)
- Website: [https://carnival.com.bd/](https://carnival.com.bd/)
- Pricing: ~0.25 BDT per SMS
- Good delivery rates in Bangladesh

### B. **Reve Systems**
- Website: [https://revesoft.com/](https://revesoft.com/)
- Enterprise-level
- Good for bulk SMS

### C. **Banglalink SMS API**
- If you have a Banglalink business account
- Direct carrier integration

---

## Solution 3: Upgrade Twilio Account (Partial Fix)

### Steps to Enable Bangladesh on Twilio

1. **Upgrade to Paid Account**
   - Add payment method in Twilio Console
   - Upgrade from trial

2. **Enable Geographic Permissions**
   - Go to: Console → Messaging → Settings → Geo Permissions
   - Enable "Bangladesh" under Asia Pacific
   - May require additional verification

3. **Register Your Brand** (USA numbers)
   - For A2P (Application-to-Person) messaging
   - Required for most countries including Bangladesh

4. **Buy a Local Bangladeshi Number** (if available)
   - Check: Console → Phone Numbers → Buy a number
   - Filter by country: Bangladesh (may not be available)

⚠️ **Note**: Even with a paid account, Twilio delivery to Bangladesh can be unreliable or expensive.

---

## Solution 4: Multi-Provider Fallback

Implement a fallback system that tries multiple providers:

```javascript
const sendSMSWithFallback = async (phoneNumber, message) => {
  const providers = [
    { name: 'SSL Wireless', fn: sendSMSViaSSL },
    { name: 'Twilio', fn: sendSMSViaTwilio },
  ];

  for (const provider of providers) {
    try {
      // console.log(`Trying ${provider.name}...`);
      await provider.fn(phoneNumber, message);
      // console.log(`✅ SMS sent via ${provider.name}`);
      return;
    } catch (error) {
      // console.error(`❌ ${provider.name} failed:`, error.message);
      continue;
    }
  }

  throw new Error('All SMS providers failed');
};
```

---

## Cost Comparison (Bangladesh)

| Provider | Cost per SMS (BDT) | Delivery Rate | Setup Difficulty |
|----------|-------------------|---------------|------------------|
| **SSL Wireless** | ~0.25 | 95%+ | Easy |
| **Carnival Internet** | ~0.25 | 95%+ | Easy |
| **Twilio (Paid)** | ~1.50+ | 70-80% | Medium |
| **Twilio (Trial)** | Free (limited) | <50% | Easy |

---

## Recommended Implementation for Bangladesh

### Hybrid Approach

1. **Use SSL Wireless for Bangladesh** (+880 numbers)
2. **Use Twilio for International** (all other countries)
3. **Implement fallback** for reliability

```javascript
// src/util/smsService.js - Complete Implementation

const axios = require('axios');
const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const sendSMSViaSSL = async (phoneNumber, message) => {
  const bdNumber = phoneNumber.replace('+880', '').replace('+88', '');
  
  const response = await axios.post(
    'https://smsplus.sslwireless.com/api/v3/send-sms/dynamic',
    {
      api_token: process.env.SSL_SMS_API_TOKEN,
      sid: process.env.SSL_SMS_SID,
      sms: message,
      msisdn: bdNumber,
      csms_id: Date.now().toString()
    }
  );

  if (response.data.status !== 'SUCCESS') {
    throw new Error(`SSL SMS failed: ${response.data.message}`);
  }

  return response.data;
};

const sendSMSViaTwilio = async (phoneNumber, message) => {
  return await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber
  });
};

const sendSMS = async (phoneNumber, message) => {
  const isBangladesh = phoneNumber.startsWith('+880') || phoneNumber.startsWith('+88');
  
  try {
    if (isBangladesh) {
      // console.log('📱 Sending SMS via SSL Wireless (Bangladesh)');
      return await sendSMSViaSSL(phoneNumber, message);
    } else {
      // console.log('📱 Sending SMS via Twilio (International)');
      return await sendSMSViaTwilio(phoneNumber, message);
    }
  } catch (error) {
    // console.error('❌ SMS sending failed:', error.message);
    throw error;
  }
};

module.exports = { sendSMS };
```

---

## Quick Fix for Testing (Development Only)

### Option 1: Mock SMS for Development

```javascript
// In phoneVerification.service.js
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment && phoneNumber.startsWith('+880')) {
  // Skip actual SMS sending in dev mode for Bangladesh
  // console.log('🧪 DEV MODE: Skipping SMS');
  // console.log('📱 Phone:', phoneNumber);
  // console.log('🔢 Code:', verificationCode);
  // Save code to database but don't send SMS
} else {
  // Send actual SMS
  await twilioClient.messages.create({...});
}
```

### Option 2: Use Test Phone Number

For testing, use a non-Bangladesh number:
```javascript
// Test with US number
const testPhone = "+1234567890";  // Works with Twilio trial

// Instead of Bangladesh
const bdPhone = "+8801712345678";  // May not work with Twilio
```

---

## Next Steps

### Immediate (for testing):
1. **Use the development mock** to test the flow without Twilio
2. **Or use a non-Bangladesh number** for testing

### Production (recommended):
1. ✅ **Sign up for SSL Wireless** - Best for Bangladesh
2. ✅ **Implement the hybrid approach** - SSL for BD, Twilio for international
3. ✅ **Test with real Bangladesh numbers**

---

## SSL Wireless Contact Info

- **Website**: https://sslwireless.com/
- **Email**: info@sslwireless.com
- **Phone**: +880 9612332200
- **Dashboard**: https://smsplus.sslwireless.com/

---

## Alternative: WhatsApp Business API

If SMS continues to be problematic, consider:
- **WhatsApp Business API** (via Twilio or Meta)
- Higher delivery rates in Bangladesh
- More expensive but more reliable
- Users need WhatsApp installed

---

## Testing Checklist

- [ ] Sign up for SSL Wireless
- [ ] Get API credentials
- [ ] Create `smsService.js` utility
- [ ] Update `.env` with SSL credentials
- [ ] Modify `phoneVerification.service.js` to use `sendSMS()`
- [ ] Test with Bangladesh number (+880)
- [ ] Test with international number
- [ ] Verify fallback works

---

## Need Help?

If you want me to implement the SSL Wireless integration, just let me know! I can:
1. Create the `smsService.js` file
2. Update `phoneVerification.service.js`
3. Add proper error handling
4. Set up the hybrid approach
