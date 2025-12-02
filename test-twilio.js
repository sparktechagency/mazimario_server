const twilio = require('twilio');
require('dotenv').config();

console.log('🔍 Testing Twilio Configuration...\n');

// Check environment variables
const requiredVars = {
    'TWILIO_ACCOUNT_SID': process.env.TWILIO_ACCOUNT_SID,
    'TWILIO_AUTH_TOKEN': process.env.TWILIO_AUTH_TOKEN,
    'TWILIO_PHONE_NUMBER': process.env.TWILIO_PHONE_NUMBER,
};

let missingVars = [];
for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
        missingVars.push(key);
        console.log(`❌ ${key}: Not set`);
    } else {
        // Mask sensitive data
        const masked = key === 'TWILIO_AUTH_TOKEN'
            ? '*'.repeat(value.length)
            : value;
        console.log(`✅ ${key}: ${masked}`);
    }
}

if (missingVars.length > 0) {
    console.error('\n❌ Missing environment variables:', missingVars.join(', '));
    console.log('\n📝 Please add them to your .env file');
    process.exit(1);
}

console.log('\n📱 Attempting to send test SMS...\n');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function testTwilio() {
    try {
        // Get user input for phone number
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Enter your phone number (E.164 format, e.g., +1234567890): ', async (phoneNumber) => {
            readline.close();

            if (!phoneNumber.startsWith('+')) {
                console.error('❌ Phone number must start with + (E.164 format)');
                process.exit(1);
            }

            console.log(`\n📤 Sending test SMS to ${phoneNumber}...`);

            const message = await client.messages.create({
                body: 'Hello from mazimario_server! 🎉 Your Twilio integration is working correctly.',
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            console.log('\n✅ SUCCESS! SMS sent successfully!');
            console.log('Message SID:', message.sid);
            console.log('Status:', message.status);
            console.log('To:', message.to);
            console.log('From:', message.from);
            console.log('\n📱 Check your phone for the text message!');
            console.log('\n🎊 Your Twilio integration is working perfectly!');
        });

    } catch (error) {
        console.error('\n❌ ERROR sending SMS:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);

        // Helpful error messages
        if (error.code === 21211) {
            console.log('\n💡 TIP: Check that the "To" number is in E.164 format (+1234567890)');
        } else if (error.code === 21606) {
            console.log('\n💡 TIP: For trial accounts, verify the phone number in Twilio Console first');
            console.log('   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        } else if (error.code === 20003) {
            console.log('\n💡 TIP: Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
            console.log('   Make sure they are correct in your .env file');
        } else if (error.code === 21614) {
            console.log('\n💡 TIP: Check that TWILIO_PHONE_NUMBER is correct and SMS-enabled');
            console.log('   Verify in: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming');
        }

        console.log('\n📚 Check Twilio error codes: https://www.twilio.com/docs/api/errors');
        process.exit(1);
    }
}

testTwilio();
