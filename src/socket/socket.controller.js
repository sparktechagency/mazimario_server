// src/socket/socket.controller.js
// Unified socket controller for ALL socket events.

const mongoose = require("mongoose");
const { EnumSocketEvent } = require("../util/enum");
const emitError = require("./emitError");
const emitResult = require("./emitResult");
const socketCatchAsync = require("../util/socketCatchAsync");

// MODELS
const Conversation = require("../app/module/chat/conversation.model");
const Message = require("../app/module/chat/message.model");
const User = require("../app/module/user/User");
const Provider = require("../app/module/provider/Provider");
const Admin = require("../app/module/admin/Admin");
const SuperAdmin = require("../app/module/superAdmin/SuperAdmin");

// ONLINE USERS MAP
const onlineUsers = new Map();

// RANDOM MATCH QUEUE
let waitingUsers = []; // { id, role, username, image, socketId }

// ------------------------------
// Utility
// ------------------------------
function roleRoom(role, id) {
  return `${role}:${id}`;
}

async function findActor(id, role) {
  switch (role) {
    case "USER": return User.findById(id).lean();
    case "PROVIDER": return Provider.findById(id).lean();
    case "ADMIN": return Admin.findById(id).lean();
    case "SUPER_ADMIN": return SuperAdmin.findById(id).lean();
    default:
      return (
        (await User.findById(id).lean()) ||
        (await Provider.findById(id).lean()) ||
        (await Admin.findById(id).lean()) ||
        (await SuperAdmin.findById(id).lean()) ||
        (await Owner.findById(id).lean())
      );
  }
}

function emitTo(io, target, event, payload) {
  if (!target) {
    console.warn("⚠️  emitTo: target is null/undefined");
    return;
  }

  let roomName;
  if (typeof target === "string") {
    roomName = target;
  } else if (target.id && target.role) {
    roomName = roleRoom(target.role.toUpperCase(), target.id);
  } else {
    console.warn("⚠️  emitTo: invalid target format", target);
    return;
  }

  console.log(`   📤 Emitting "${event}" to room: ${roomName}`);
  
  // Get sockets in the room to verify delivery
  io.in(roomName).fetchSockets().then(sockets => {
    if (sockets.length > 0) {
      console.log(`   ✅ Event "${event}" delivered to ${sockets.length} socket(s) in room ${roomName}`);
      sockets.forEach(socket => {
        console.log(`      - Socket ID: ${socket.id}`);
      });
    } else {
      console.warn(`   ⚠️  No sockets found in room ${roomName} - event "${event}" not delivered!`);
    }
  });
  
  io.to(roomName).emit(event, payload);
}

// ------------------------------
// MAIN CONTROLLER
// ------------------------------
module.exports = function socketController(io) {
  io.on(EnumSocketEvent.CONNECTION, async (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);

    const userId = socket.handshake.query.id;
    const userRole = (socket.handshake.query.role || "USER").toUpperCase();

    if (!userId) {
      emitError(socket, 400, "Missing userId", true);
      return;
    }

    const myRoom = roleRoom(userRole, userId);
    socket.join(myRoom);
    onlineUsers.set(myRoom, socket.id);

    socket._meta = { id: userId, role: userRole, room: myRoom };

    console.log("   User joined room:", myRoom);
    console.log("   Total online users:", onlineUsers.size);

    // Use CONNECTION_CONFIRMED instead of CONNECT (which is reserved by Socket.IO)
    socket.emit(
      EnumSocketEvent.CONNECTION_CONFIRMED,
      emitResult({
        statusCode: 200,
        success: true,
        message: "Connected to socket",
        data: { room: myRoom }
      })
    );

    // ------------------------------
    // TYPING EVENTS
    // ------------------------------
    socket.on("typing", ({ conversationId, sender, receiver }) => {
      emitTo(io, receiver, "typing", { conversationId, sender });
    });

    socket.on("stop_typing", ({ conversationId, sender, receiver }) => {
      emitTo(io, receiver, "stop_typing", { conversationId, sender });
    });

    // ------------------------------
    // PING / PONG
    // ------------------------------
    socket.on("ping", (data) => socket.emit("pong", data));

    // ------------------------------
    // RANDOM MATCH
    // ------------------------------
    socket.on("join-random", (data) => {
      const id = data.currentUserId || userId;
      const role = (data.role || userRole).toUpperCase();

      if (waitingUsers.some((u) => u.id === id)) {
        return socket.emit("match-status", { message: "Already waiting" });
      }

      if (waitingUsers.length > 0) {
        const index = Math.floor(Math.random() * waitingUsers.length);
        const matched = waitingUsers.splice(index, 1)[0];

        const callId = `call_${matched.id}_${id}`;

        emitTo(io, matched, `match-found/${matched.id}`, {
          callId,
          userId: id,
          username: data.username,
          image: data.image,
          role
        });

        emitTo(io, { id, role }, `match-found/${id}`, {
          callId,
          userId: matched.id,
          username: matched.username,
          image: matched.image,
          role: matched.role
        });

        return;
      }

      waitingUsers.push({
        id,
        role,
        username: data.username,
        image: data.image,
        socketId: socket.id
      });

      socket.emit("match-status", { message: "Waiting" });
    });

    socket.on("cancel-waiting", (id) => {
      waitingUsers = waitingUsers.filter((u) => u.id !== id);
      socket.emit("match-status", { message: "Removed from waiting list" });
    });

    // ------------------------------
    // MARK MESSAGES AS READ
    // ------------------------------
    socket.on(
      EnumSocketEvent.MARK_MESSAGES_AS_READ,
      socketCatchAsync(async ({ conversationId, myId, myRole, senderId, senderRole }) => {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return emitError(socket, 404, "Conversation not found");
        }

        await Message.updateMany(
          {
            conversationId,
            "receiver.id": myId,
            "receiver.role": myRole,
            seen: false
          },
          { $set: { seen: true } }
        );

        emitTo(io, { id: myId, role: myRole }, EnumSocketEvent.MARK_MESSAGES_AS_READ, {
          conversationId,
          seen: true
        });

        emitTo(io, { id: senderId, role: senderRole }, EnumSocketEvent.MARK_MESSAGES_AS_READ, {
          conversationId,
          seen: true
        });
      })
    );

    // ------------------------------
    // SEND MESSAGE HANDLER
    // ------------------------------
    const handleSendMessage = socketCatchAsync(async (payload) => {
      const { sender, receiver, text, images, video, videoCover } = payload;

      console.log("\n📨 MESSAGE RECEIVED:");
      console.log("   From:", sender);
      console.log("   To:", receiver);
      console.log("   Text:", text);

      if (!sender?.id || !receiver?.id) {
        console.error("❌ Missing sender or receiver");
        return emitError(socket, 400, "Sender and receiver required");
      }

      // Check if receiver is online
      const receiverRoom = roleRoom(receiver.role.toUpperCase(), receiver.id);
      const senderRoom = roleRoom(sender.role.toUpperCase(), sender.id);
      
      console.log("   Receiver Room:", receiverRoom);
      console.log("   Sender Room:", senderRoom);
      console.log("   Receiver Online:", onlineUsers.has(receiverRoom));
      console.log("   Sender Online:", onlineUsers.has(senderRoom));

      // Get all sockets in the receiver's room to verify
      const receiverRoomSockets = await io.in(receiverRoom).fetchSockets();
      console.log("   Sockets in receiver room:", receiverRoomSockets.length);

      let conversation = await Conversation.findOne({
        "participants.id": { $all: [sender.id, receiver.id] }
      });

      if (!conversation) {
        console.log("   Creating new conversation");
        conversation = await Conversation.create({
          participants: [
            { id: sender.id, role: sender.role },
            { id: receiver.id, role: receiver.role }
          ],
          messages: []
        });
      } else {
        console.log("   Using existing conversation:", conversation._id);
      }

      const newMessage = await Message.create({
        conversationId: conversation._id,
        sender,
        receiver,
        text: text || "",
        images: images || [],
        video: video || "",
        videoCover: videoCover || "",
        seen: false
      });

      console.log("   Message saved to DB:", newMessage._id);

      conversation.messages.push(newMessage._id);
      conversation.updatedAt = new Date();
      await conversation.save();

      // send to receiver
      const receiverEvent = `${EnumSocketEvent.MESSAGE_NEW}/${sender.id}`;
      console.log("   Emitting to receiver:", receiverEvent, "Room:", receiverRoom);
      emitTo(
        io,
        receiver,
        receiverEvent,
        newMessage
      );
      
      // Also emit to generic event name for easier Postman testing
      console.log("   Also emitting generic 'message_new' to receiver");
      emitTo(
        io,
        receiver,
        EnumSocketEvent.MESSAGE_NEW,
        newMessage
      );

      // send to sender
      const senderEvent = `${EnumSocketEvent.MESSAGE_NEW}/${receiver.id}`;
      console.log("   Emitting to sender:", senderEvent, "Room:", senderRoom);
      emitTo(
        io,
        sender,
        senderEvent,
        newMessage
      );
      
      // Also emit to generic event name for easier Postman testing
      console.log("   Also emitting generic 'message_new' to sender");
      emitTo(
        io,
        sender,
        EnumSocketEvent.MESSAGE_NEW,
        newMessage
      );

      // conversation updates
      const convoUpdate = {
        conversationId: conversation._id,
        participants: conversation.participants,
        lastMessage: newMessage,
        updatedAt: conversation.updatedAt
      };

      const receiverConvoEvent = `${EnumSocketEvent.CONVERSATION_UPDATE}/${receiver.id}`;
      console.log("   Emitting conversation update to receiver:", receiverConvoEvent);
      emitTo(
        io,
        receiver,
        receiverConvoEvent,
        convoUpdate
      );
      
      // Also emit to generic event name for easier Postman testing
      console.log("   Also emitting generic 'conversation_update' to receiver");
      emitTo(
        io,
        receiver,
        EnumSocketEvent.CONVERSATION_UPDATE,
        convoUpdate
      );

      const senderConvoEvent = `${EnumSocketEvent.CONVERSATION_UPDATE}/${sender.id}`;
      console.log("   Emitting conversation update to sender:", senderConvoEvent);
      emitTo(
        io,
        sender,
        senderConvoEvent,
        convoUpdate
      );
      
      // Also emit to generic event name for easier Postman testing
      console.log("   Also emitting generic 'conversation_update' to sender");
      emitTo(
        io,
        sender,
        EnumSocketEvent.CONVERSATION_UPDATE,
        convoUpdate
      );

      console.log("✅ Message processing complete\n");
    });

    // Support both event names for compatibility
    socket.on(EnumSocketEvent.MESSAGE_NEW, handleSendMessage);
    socket.on(EnumSocketEvent.SEND_MESSAGE, handleSendMessage);

    // Debug: List all online users
    socket.on("debug-online-users", () => {
      console.log("\n📊 ONLINE USERS DEBUG:");
      console.log("   Total online:", onlineUsers.size);
      onlineUsers.forEach((socketId, room) => {
        console.log(`   Room: ${room} -> Socket: ${socketId}`);
      });
      socket.emit("debug-online-users-response", {
        total: onlineUsers.size,
        users: Array.from(onlineUsers.entries()).map(([room, socketId]) => ({
          room,
          socketId
        }))
      });
    });

    // ------------------------------
    // DISCONNECT
    // ------------------------------
    socket.on(EnumSocketEvent.DISCONNECT, () => {
      onlineUsers.delete(myRoom);
      console.log("USER DISCONNECTED:", myRoom);
    });

    socket.on("error", (e) => {
      console.error("Socket error:", e);
    });
  });

  return { onlineUsers, waitingUsers };
};
