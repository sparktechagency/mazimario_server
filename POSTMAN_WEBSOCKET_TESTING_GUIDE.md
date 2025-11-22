# Postman WebSocket Testing Guide for Socket.IO Chat

## Understanding Your Setup

✅ **Your server and socket ARE running on the same port!** 

Your setup is correct:
- HTTP server is created from Express app
- Socket.IO is attached to the same HTTP server
- Both run on the same port (from `config.port`)

## Step 1: Start Your Server

1. Make sure your `.env` file has the `PORT` variable set (e.g., `PORT=5000`)
2. Run your server:
   ```bash
   npm run dev
   # or
   npm start
   ```
3. You should see: `App listening on http://:5000` (or your port)

## ⚠️ Important Note About Postman and Socket.IO

**Socket.IO uses a custom protocol** that may not work perfectly with Postman's native WebSocket client. Socket.IO requires:
- A specific handshake protocol
- Message format encoding (42, 40, 41 prefixes)
- Transport negotiation

**Recommended:** Use the `test-socket.js` script provided (see below) for easier testing, or use a Socket.IO client library.

If you still want to try Postman, follow the steps below, but be aware it may have limitations.

## Step 2: Setup Postman WebSocket Connection

### A. Create New WebSocket Request

1. Open Postman
2. Click **"New"** → Select **"WebSocket Request"**
3. In the URL field, enter:
   ```
   ws://localhost:5000/socket.io/?EIO=4&transport=websocket&id=YOUR_USER_ID&role=USER
   ```
   
   **Replace:**
   - `5000` with your actual port
   - `YOUR_USER_ID` with a valid user ID from your database (e.g., `507f1f77bcf86cd799439011`)
   - `role` can be: `USER`, `PROVIDER`, `ADMIN`, or `SUPER_ADMIN`

   **Example:**
   ```
   ws://localhost:5000/socket.io/?EIO=4&transport=websocket&id=507f1f77bcf86cd799439011&role=USER
   ```
   
   **Note:** `EIO=4` refers to Engine.IO version 4 (used by Socket.IO v4.x)

### B. Connect to Socket

1. Click **"Connect"** button
2. You should see connection messages in the messages panel
3. Look for a message with event `connection_confirmed` containing:
   ```json
   {
     "statusCode": 200,
     "success": true,
     "message": "Connected to socket",
     "data": {
       "room": "USER:507f1f77bcf86cd799439011"
     }
   }
   ```
   
   **Note:** The server emits `connection_confirmed` event (not `connect`, which is reserved by Socket.IO)

## Step 3: Test Socket Events

### Test 1: Ping/Pong (Simple Connection Test)

**Send:**
```json
42["ping", {"test": "data"}]
```

**Expected Response:**
```json
42["pong", {"test": "data"}]
```

**Note:** Socket.IO uses a special format: `42` is the message type, followed by a JSON array with `[eventName, data]`

### Test 2: Send a Message

**IMPORTANT:** The server accepts both `send_message` and `message_new` events. Use either one.

**Option 1 - Using `send_message` (as shown in your Postman):**
```json
42["send_message", {
  "sender": {
    "id": "507f1f77bcf86cd799439011",
    "role": "USER"
  },
  "receiver": {
    "id": "507f1f77bcf86cd799439012",
    "role": "PROVIDER"
  },
  "text": "Hello from Postman!",
  "images": [],
  "video": "",
  "videoCover": ""
}]
```

**Option 2 - Using `message_new`:**
```json
42["message_new", {
  "sender": {
    "id": "507f1f77bcf86cd799439011",
    "role": "USER"
  },
  "receiver": {
    "id": "507f1f77bcf86cd799439012",
    "role": "PROVIDER"
  },
  "text": "Hello from Postman!",
  "images": [],
  "video": "",
  "videoCover": ""
}]
```

**Expected Response:**
You should receive messages on:
- `message_new/{senderId}` (to receiver - e.g., `message_new/507f1f77bcf86cd799439011`)
- `message_new/{receiverId}` (to sender - e.g., `message_new/507f1f77bcf86cd799439012`)
- `conversation_update/{receiverId}` (to receiver - e.g., `conversation_update/507f1f77bcf86cd799439012`)
- `conversation_update/{senderId}` (to sender - e.g., `conversation_update/507f1f77bcf86cd799439011`)

**⚠️ IMPORTANT: Set Up Event Listeners in Postman!**

Postman requires you to **explicitly listen for events** in the Events tab. See `POSTMAN_EVENT_LISTENERS_SETUP.md` for detailed instructions.

**Quick Setup:**
1. Click the **"Events"** tab in Postman
2. Add these event listeners for the **RECEIVER**:
   - `message_new/{senderId}` (replace with actual sender ID)
   - `conversation_update/{receiverId}` (replace with actual receiver ID)
3. Add these event listeners for the **SENDER**:
   - `message_new/{receiverId}` (replace with actual receiver ID)
   - `conversation_update/{senderId}` (replace with actual sender ID)

### Test 3: Typing Indicator

**Send:**
```json
42["typing", {
  "conversationId": "507f1f77bcf86cd799439013",
  "sender": {
    "id": "507f1f77bcf86cd799439011",
    "role": "USER"
  },
  "receiver": {
    "id": "507f1f77bcf86cd799439012",
    "role": "USER"
  }
}]
```

### Test 4: Stop Typing

**Send:**
```json
42["stop_typing", {
  "conversationId": "507f1f77bcf86cd799439013",
  "sender": {
    "id": "507f1f77bcf86cd799439011",
    "role": "USER"
  },
  "receiver": {
    "id": "507f1f77bcf86cd799439012",
    "role": "USER"
  }
}]
```

### Test 5: Mark Messages as Read

**Send:**
```json
42["mark_messages_as_read", {
  "conversationId": "507f1f77bcf86cd799439013",
  "myId": "507f1f77bcf86cd799439011",
  "myRole": "USER",
  "senderId": "507f1f77bcf86cd799439012",
  "senderRole": "USER"
}]
```

### Test 6: Random Match (Join Queue)

**Send:**
```json
42["join-random", {
  "currentUserId": "507f1f77bcf86cd799439011",
  "role": "USER",
  "username": "TestUser",
  "image": "https://example.com/image.jpg"
}]
```

**Expected Response:**
- `match-status` with message "Waiting" or "Already waiting"
- If another user is waiting, you'll get `match-found/YOUR_ID` with match details

## Step 4: Testing with Two Connections (Chat Test)

To properly test chat, you need **TWO WebSocket connections** in Postman:

1. **Connection 1 (User 1):**
   ```
   ws://localhost:5000/socket.io/?EIO=4&transport=websocket&id=USER1_ID&role=USER
   ```

2. **Connection 2 (User 2):**
   ```
   ws://localhost:5000/socket.io/?EIO=4&transport=websocket&id=USER2_ID&role=USER
   ```

3. **From Connection 1, send a message to User 2:**
   ```json
   42["message_new", {
     "sender": {"id": "USER1_ID", "role": "USER"},
     "receiver": {"id": "USER2_ID", "role": "USER"},
     "text": "Hello User 2!",
     "images": [],
     "video": "",
     "videoCover": ""
   }]
   ```

4. **Check Connection 2** - You should receive:
   - Event: `message_new/USER1_ID`
   - Event: `conversation_update/USER2_ID`

## Important Notes

### Socket.IO Message Format

Socket.IO uses a specific message format:
- `42` = Event message type
- `40` = Connection acknowledgment
- `41` = Disconnection
- Format: `[type][JSON array]`

Example: `42["event_name", {data}]`

### Getting Valid User IDs

To get valid user IDs for testing:
1. Check your MongoDB database
2. Or create a test endpoint that returns user IDs
3. Or use your existing API to get user information

### Common Issues

1. **Connection Fails:**
   - Check if server is running
   - Verify port number
   - Check if `id` query parameter is provided (required!)

2. **No Response:**
   - Make sure you're using the correct event names
   - Check server console for errors
   - Verify user IDs exist in database

3. **CORS Issues:**
   - Your socketCors allows all origins (`origin: "*"`), so this shouldn't be an issue

## Quick Test Checklist

- [ ] Server is running on correct port
- [ ] WebSocket connection established in Postman
- [ ] Received `connection_confirmed` event with success message
- [ ] Ping/Pong test works
- [ ] Can send messages
- [ ] Can receive messages (with two connections)
- [ ] Typing indicators work
- [ ] Messages are saved to database

## ✅ Recommended: Use the Test Script

Instead of Postman, use the provided `test-socket.js` script for easier testing:

1. **Update the configuration** in `test-socket.js`:
   - Set `USER1_ID` and `USER2_ID` with valid user IDs from your database
   - Adjust `SERVER_URL` if your port is different

2. **Run the test script:**
   ```bash
   node test-socket.js
   ```

3. **The script will automatically:**
   - Connect both users
   - Test ping/pong
   - Send a test message
   - Test typing indicators
   - Show all received messages and events

This is much easier than Postman for Socket.IO testing!

## Alternative: Simple Socket.IO Client Test

You can also create your own simple test:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  query: {
    id: 'YOUR_USER_ID',
    role: 'USER'
  }
});

socket.on('connection_confirmed', (data) => {
  console.log('Connection confirmed:', data);
});

socket.on('message_new/USER2_ID', (message) => {
  console.log('New message:', message);
});

socket.emit('message_new', {
  sender: { id: 'USER1_ID', role: 'USER' },
  receiver: { id: 'USER2_ID', role: 'USER' },
  text: 'Hello!',
  images: [],
  video: '',
  videoCover: ''
});
```

---

**Need Help?** Check your server console logs for connection messages and errors.

