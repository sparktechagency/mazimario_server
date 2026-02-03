/**
 * Socket.IO Test Script
 * 
 * This script helps you test your Socket.IO connection and chat functionality.
 * 
 * Usage:
 * 1. Make sure your server is running (npm run dev)
 * 2. Update USER1_ID and USER2_ID with valid IDs from your database
 * 3. Run: node test-socket.js
 */

const io = require('socket.io-client');

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const SERVER_URL = 'http://localhost:5002'; // Change if your port is different
const USER1_ID = 'YOUR_USER1_ID_HERE'; // Replace with actual user ID
const USER1_ROLE = 'USER'; // USER, PROVIDER, ADMIN, or SUPER_ADMIN
const USER2_ID = 'YOUR_USER2_ID_HERE'; // Replace with actual user ID
const USER2_ROLE = 'USER'; // USER, PROVIDER, ADMIN, or SUPER_ADMIN

// Validate configuration
if (USER1_ID === '69004ca0f264122b09c5bd43' || USER2_ID === '6902f3965f73e246ecc52532') {
  // console.error('\n❌ ERROR: Please update USER1_ID and USER2_ID with valid user IDs from your database!');
  // console.error('   The socket connection requires valid user IDs in the query parameters.\n');
  process.exit(1);
}

// ============================================
// USER 1 SOCKET
// ============================================
// console.log('\n🔌 Connecting User 1...');
const socket1 = io(SERVER_URL, {
  query: {
    id: "69004ca0f264122b09c5bd43",
    role: "USER"
  },
  transports: ['websocket', 'polling']
});

// Built-in Socket.IO connect event
socket1.on('connect', () => {
  // console.log('✅ User 1 Connected!');
  // console.log('   Socket ID:', socket1.id);
  // console.log('   Server URL:', SERVER_URL);
  // console.log('   User ID:', "69004ca0f264122b09c5bd43");
  // console.log('   User Role:', USER1_ROLE);
});

socket1.on('connect_error', (error) => {
  console.error('❌ User 1 Connection Error:', error.message);
  console.error('   Make sure:');
  console.error('   1. Server is running on', SERVER_URL);
  console.error('   2. USER1_ID is valid:', "69004ca0f264122b09c5bd43");
  console.error('   3. Server allows connections from this client');
  if (error.description) {
    console.error('   Error details:', error.description);
  }
});

socket1.on('disconnect', (reason) => {
  // console.log('⚠️  User 1 Disconnected:', reason);
});

// Listen for server's connection confirmation event
socket1.on('connection_confirmed', (data) => {
  // console.log('✅ User 1 - Connection Confirmed by Server!');
  if (data && data.data && data.data.room) {
    // console.log('   Room:', data.data.room);
  }
  if (data && data.message) {
    // console.log('   Message:', data.message);
  }
});

// Listen for messages
socket1.on(`message_new/${`6902f3965f73e246ecc52532`}`, (message) => {
  // console.log('\n📨 User 1 received message from User 2:');
  // console.log('   Message:', message);
});

// Listen for conversation updates
socket1.on(`conversation_update/${`69004ca0f264122b09c5bd43`}`, (update) => {
  //console.log('\n💬 User 1 - Conversation Updated:');
  //console.log('   Update:', update);
});

// Listen for typing indicators
socket1.on('typing', (data) => {
  // console.log('\n⌨️  User 2 is typing...');
  // console.log('   Data:', data);
});

socket1.on('stop_typing', (data) => {
  // console.log('\n⏸️  User 2 stopped typing');
  // console.log('   Data:', data);
});

// ============================================
// USER 2 SOCKET (Optional - for full chat test)
// ============================================
console.log('\n🔌 Connecting User 2...');
const socket2 = io(SERVER_URL, {
  query: {
    id: "6902f3965f73e246ecc52532",
    role: "PROVIDER"
  },
  transports: ['websocket', 'polling']
});

// Built-in Socket.IO connect event
socket2.on('connect', () => {
  // console.log('✅ User 2 Connected!');
  // console.log('   Socket ID:', socket2.id);
  // console.log('   Server URL:', SERVER_URL);
  // console.log('   User ID:', "6902f3965f73e246ecc52532");
  // console.log('   User Role:', USER2_ROLE);
});

socket2.on('connect_error', (error) => {
  // console.error('❌ User 2 Connection Error:', error.message);
  // console.error('   Make sure:');
  // console.error('   1. Server is running on', SERVER_URL);
  // console.error('   2. USER2_ID is valid:', "6902f3965f73e246ecc52532");
  // console.error('   3. Server allows connections from this client');
  if (error.description) {
    // console.error('   Error details:', error.description);
  }
});

socket2.on('disconnect', (reason) => {
  // console.log('⚠️  User 2 Disconnected:', reason);
});

// Listen for server's connection confirmation event
socket2.on('connection_confirmed', (data) => {
  // console.log('✅ User 2 - Connection Confirmed by Server!');
  if (data && data.data && data.data.room) {
    // console.log('   Room:', data.data.room);
  }
  if (data && data.message) {
    //  console.log('   Message:', data.message);
  }
});

// Listen for messages
socket2.on(`message_new/${`69004ca0f264122b09c5bd43`}`, (message) => {
  // console.log('\n📨 User 2 received message from User 1:');
  // console.log('   Message:', message);
});

// Listen for conversation updates
socket2.on(`conversation_update/${`6902f3965f73e246ecc52532`}`, (update) => {
  // console.log('\n💬 User 2 - Conversation Updated:');
  // console.log('   Update:', update);
});

// ============================================
// TEST FUNCTIONS
// ============================================

function testPing() {
  // console.log('\n🧪 Testing Ping/Pong...');
  socket1.emit('ping', { test: 'data', timestamp: Date.now() });
  socket1.once('pong', (data) => {
    // console.log('✅ Pong received:', data);
  });
}

function sendMessage() {
  // console.log('\n📤 Sending message from User 1 to User 2...');
  socket1.emit('message_new', {
    sender: {
      id: "69004ca0f264122b09c5bd43",
      role: "USER"
    },
    receiver: {
      id: "6902f3965f73e246ecc52532",
      role: "PROVIDER"
    },
    text: `Hello from User 1! Time: ${new Date().toLocaleTimeString()}`,
    images: [],
    video: '',
    videoCover: ''
  });
  // console.log('   Message sent!');
}

function testTyping() {
  // console.log('\n⌨️  Testing typing indicator...');
  socket1.emit('typing', {
    conversationId: 'test-conversation-id',
    sender: { id: "69004ca0f264122b09c5bd43", role: "USER" },
    receiver: { id: "6902f3965f73e246ecc52532", role: "PROVIDER" }
  });

  setTimeout(() => {
    socket1.emit('stop_typing', {
      conversationId: 'test-conversation-id',
      sender: { id: "69004ca0f264122b09c5bd43", role: "USER" },
      receiver: { id: "6902f3965f73e246ecc52532", role: "PROVIDER" }
    });
    // console.log('   Typing stopped');
  }, 2000);
}

function testRandomMatch() {
  //console.log('\n🎲 Testing random match...');
  socket1.emit('join-random', {
    currentUserId: "69004ca0f264122b09c5bd43",
    role: "USER",
    username: 'TestUser1',
    image: 'https://example.com/image.jpg'
  });

  socket1.once('match-status', (status) => {
    // console.log('   Match Status:', status);
  });
}

// ============================================
// AUTO-RUN TESTS AFTER CONNECTION
// ============================================
setTimeout(() => {
  // console.log('\n\n' + '='.repeat(50));
  // console.log('🚀 Starting Tests...');
  // console.log('='.repeat(50));

  // Wait a bit for connections to stabilize
  setTimeout(() => {
    testPing();

    setTimeout(() => {
      sendMessage();
    }, 1000);

    setTimeout(() => {
      testTyping();
    }, 3000);

    // Uncomment to test random match
    // setTimeout(() => {
    //   testRandomMatch();
    // }, 5000);

  }, 2000);
}, 3000);

// ============================================
// MANUAL TESTING (Uncomment to use)
// ============================================
// Uncomment the function calls below to manually test:

// setTimeout(() => {
//   sendMessage();
// }, 5000);

// ============================================
// CLEANUP
// ============================================
process.on('SIGINT', () => {
  // console.log('\n\n👋 Disconnecting...');
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
});

// console.log('\n' + '='.repeat(60));
// console.log('📝 Socket.IO Test Script');
// console.log('='.repeat(60));
// console.log('Configuration:');
// console.log('   Server URL:', SERVER_URL);
// console.log('   User 1 ID:', "69004ca0f264122b09c5bd43");
// console.log('   User 1 Role:', "USER");
// console.log('   User 2 ID:', "6902f3965f73e246ecc52532");
// console.log('   User 2 Role:', "PROVIDER");
// console.log('\n📋 Instructions:');
// console.log('   1. Make sure your server is running on', SERVER_URL);
// console.log('   2. Make sure "69004ca0f264122b09c5bd43" and "6902f3965f73e246ecc52532" are valid IDs from your database');
// console.log('   3. Watch the console for test results');
// console.log('   4. Check your server console for connection logs');
// console.log('   5. Press Ctrl+C to exit');
// console.log('='.repeat(60) + '\n');

