# Simple Event Names for Postman Testing

## ✅ Good News!

I've updated the server to emit events to **BOTH** specific and generic event names. This makes Postman testing much easier!

## Simple Event Listeners (No User IDs Needed!)

You can now listen to these **simple event names** in Postman:

### For Both USER and PROVIDER:

1. **`message_new`** - You'll receive all new messages
2. **`conversation_update`** - You'll receive all conversation updates

That's it! No need to add user IDs to the event names.

## How to Set Up in Postman

### Step 1: Open Events Tab
1. In your Postman WebSocket request
2. Click the **"Events"** tab

### Step 2: Add Simple Event Listeners
Add these two events (same for both USER and PROVIDER):
- `message_new`
- `conversation_update`

### Step 3: Test
Send a message and you should see:
- Event: `message_new` with the message data
- Event: `conversation_update` with the conversation data

## What Changed?

The server now emits to **both**:
- ✅ Generic events: `message_new`, `conversation_update` (easy for Postman)
- ✅ Specific events: `message_new/{userId}`, `conversation_update/{userId}` (for your app)

This means:
- **Postman users** can listen to simple event names
- **Your app** can still use specific event names with user IDs for targeted delivery

## Example

When USER sends a message to PROVIDER:

**PROVIDER will receive:**
- `message_new` (generic - easy for Postman)
- `message_new/69004ca0f264122b09c5bd43` (specific - for your app)

- `conversation_update` (generic - easy for Postman)
- `conversation_update/6902f3965f73e246ecc52532` (specific - for your app)

## Try It Now!

1. **Restart your server** to get the new changes
2. **In Postman Events tab**, add:
   - `message_new`
   - `conversation_update`
3. **Send a message** and check Postman - you should see both events!

No more complex event names with user IDs needed for testing! 🎉

