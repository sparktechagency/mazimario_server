# How to Set Up Event Listeners in Postman for Socket.IO

## The Problem

Your server is emitting events, but Postman won't show them unless you **explicitly listen for them** in the Events tab.

## Solution: Set Up Event Listeners

### Step 1: Open the Events Tab

1. In your Postman WebSocket request, click on the **"Events"** tab (next to "Message" tab)
2. You should see a section for adding event listeners

### Step 2: Add Event Listeners for Receiver (PROVIDER)

The PROVIDER (receiver) needs to listen for these events:

#### Event 1: New Messages
- **Event Name:** `message_new/69004ca0f264122b09c5bd43`
  - This is: `message_new/{senderId}`
  - Replace `69004ca0f264122b09c5bd43` with the actual sender's (USER) ID

#### Event 2: Conversation Updates
- **Event Name:** `conversation_update/6902f3965f73e246ecc52532`
  - This is: `conversation_update/{receiverId}`
  - Replace `6902f3965f73e246ecc52532` with the actual receiver's (PROVIDER) ID

### Step 3: Add Event Listeners for Sender (USER)

The USER (sender) needs to listen for these events:

#### Event 1: New Messages
- **Event Name:** `message_new/6902f3965f73e246ecc52532`
  - This is: `message_new/{receiverId}`
  - Replace `6902f3965f73e246ecc52532` with the actual receiver's (PROVIDER) ID

#### Event 2: Conversation Updates
- **Event Name:** `conversation_update/69004ca0f264122b09c5bd43`
  - This is: `conversation_update/{senderId}`
  - Replace `69004ca0f264122b09c5bd43` with the actual sender's (USER) ID

## How to Add Events in Postman

1. In the **Events** tab, you'll see an input field for event names
2. Type the event name (e.g., `conversation_update/6902f3965f73e246ecc52532`)
3. Click **"Add"** or press Enter
4. The event will appear in the list of events being listened to
5. When the server emits this event, it will appear in the messages panel

## Complete Event List for Your Setup

### For PROVIDER (Receiver) Connection:
```
message_new/69004ca0f264122b09c5bd43
conversation_update/6902f3965f73e246ecc52532
```

### For USER (Sender) Connection:
```
message_new/6902f3965f73e246ecc52532
conversation_update/69004ca0f264122b09c5bd43
```

## Visual Guide

In Postman's Events tab, you should see something like:

```
Events (2)
├── message_new/69004ca0f264122b09c5bd43
└── conversation_update/6902f3965f73e246ecc52532
```

## Important Notes

1. **Event names are case-sensitive** - make sure they match exactly
2. **Event names include the user ID** - they're dynamic based on who's sending/receiving
3. **You must add listeners BEFORE sending messages** - if you add them after, you'll miss events
4. **Each connection needs its own event listeners** - USER and PROVIDER connections are separate

## Testing

1. **Connect both USER and PROVIDER** in separate Postman tabs/windows
2. **Add the event listeners** to each connection (as shown above)
3. **Send a message** from USER to PROVIDER
4. **Check the PROVIDER's Postman** - you should see:
   - Event: `message_new/69004ca0f264122b09c5bd43` with the message data
   - Event: `conversation_update/6902f3965f73e246ecc52532` with conversation data

## Alternative: Listen to All Events (Wildcard)

If Postman supports wildcards, you could try:
- `message_new/*` (to catch all message_new events)
- `conversation_update/*` (to catch all conversation_update events)

But the specific event names with IDs are more reliable.

## Troubleshooting

### Issue: Events not showing up
- ✅ Check that event listeners are added in the Events tab
- ✅ Verify the event name matches exactly (including the ID)
- ✅ Make sure the connection is still active (green dot)
- ✅ Check server logs to confirm events are being emitted

### Issue: Wrong event name
- The event name format is: `{eventType}/{userId}`
- For conversation updates: `conversation_update/{yourUserId}`
- For new messages: `message_new/{otherUserId}`

### Issue: Only seeing some events
- Make sure you've added ALL the event listeners you need
- Each user needs to listen for events with their own ID and the other user's ID

