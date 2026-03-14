/**
 * Standalone Twilio diagnostics script
 * Run: node test-twilio.js
 */
require("dotenv").config();
const twilio = require("twilio");

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_NUMBER;
const MSG_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

console.log("=== Twilio Credential Check ===");
console.log(
  "ACCOUNT_SID:",
  SID
    ? `${SID.slice(0, 6)}...${SID.slice(-4)} (length: ${SID.length})`
    : "❌ MISSING"
);
console.log(
  "AUTH_TOKEN: ",
  TOKEN
    ? `${TOKEN.slice(0, 4)}...${TOKEN.slice(-4)} (length: ${TOKEN.length})`
    : "❌ MISSING"
);
console.log("PHONE_NUMBER:", FROM || "❌ MISSING");
console.log(
  "MSG_SERVICE_SID:",
  MSG_SID ? `${MSG_SID.slice(0, 6)}...${MSG_SID.slice(-4)}` : "❌ MISSING"
);
console.log("================================\n");

if (!SID || !TOKEN) {
  console.error("❌ Missing credentials. Check your .env file.");
  process.exit(1);
}

const client = twilio(SID, TOKEN);

async function run() {
  // Step 1: Verify credentials by fetching account info
  console.log("Step 1: Verifying credentials...");
  try {
    const account = await client.api.accounts(SID).fetch();
    console.log("✅ Credentials are VALID!");
    console.log("   Account Name:", account.friendlyName);
    console.log("   Account Status:", account.status);
  } catch (err) {
    console.error("❌ Credential verification FAILED:");
    console.error("   Error Code:", err.code);
    console.error("   Message:", err.message);
    console.log(
      "\n💡 Fix: Copy your Account SID and Auth Token character-by-character from:"
    );
    console.log("   https://console.twilio.com → API keys & tokens");
    process.exit(1);
  }

  // Step 2: Send a test SMS using direct FROM number (bypassing Messaging Service)
  console.log(
    "\nStep 2: Sending test SMS to +8801767677517 (direct FROM number)..."
  );
  try {
    const params = {
      body: "Mazimario test SMS - if you receive this, Twilio is working!",
      to: "+8801767677517",
      from: FROM,
    };

    const msg = await client.messages.create(params);
    console.log("✅ SMS sent successfully!");
    console.log("   Message SID:", msg.sid);
    console.log("   Status:", msg.status);
  } catch (err) {
    console.error("❌ SMS send FAILED (direct FROM):");
    console.error("   Error Code:", err.code);
    console.error("   Message:", err.message);
    console.error("   More info:", err.moreInfo);
  }

  // Step 3: Try with Messaging Service SID
  if (MSG_SID) {
    console.log("\nStep 3: Sending test SMS using Messaging Service SID...");
    try {
      const params = {
        body: "Mazimario test SMS via Messaging Service!",
        to: "+8801767677517",
        messagingServiceSid: MSG_SID,
      };

      const msg = await client.messages.create(params);
      console.log("✅ SMS via Messaging Service sent successfully!");
      console.log("   Message SID:", msg.sid);
      console.log("   Status:", msg.status);
    } catch (err) {
      console.error("❌ SMS send FAILED (Messaging Service):");
      console.error("   Error Code:", err.code);
      console.error("   Message:", err.message);
      console.error("   More info:", err.moreInfo);
    }
  }
}

run();
