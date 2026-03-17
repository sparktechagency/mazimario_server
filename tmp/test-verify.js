require("dotenv").config();
const twilio = require("twilio");

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

console.log("Using SERVICE_SID:", SERVICE_SID);

const client = twilio(SID, TOKEN);

async function test() {
  try {
    console.log("Fetching service info...");
    const service = await client.verify.v2.services(SERVICE_SID).fetch();
    console.log("✅ Service exists:", service.friendlyName);
    
    console.log("Attempting a dummy verification check (expecting 404 only if SID or number is wrong)...");
    // This should fail with 'Verification check not found' (404) OR 'Invalid parameter' but NOT 'Resource not found' for the service
    await client.verify.v2.services(SERVICE_SID).verificationChecks.create({
      to: "+1234567890",
      code: "123456"
    });
  } catch (err) {
    console.log("Caught Error:");
    console.log("Status:", err.status);
    console.log("Code:", err.code);
    console.log("Message:", err.message);
    console.log("URL:", err.url);
  }
}

test();
