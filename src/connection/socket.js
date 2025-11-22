// src/connection/socket.js
const http = require("http");
const { Server } = require("socket.io");

const app = require("../app");
const socketCors = require("./socketCors");
const socketController = require("../socket/socket.controller");
const { EnumSocketEvent } = require("../util/enum");

// Create HTTP server
const mainServer = http.createServer(app);

// Create Socket.IO server
const io = new Server(mainServer, {
  cors: socketCors,   // Allow frontend to connect
});

// Bind all socket events from your unified socket.controller.js
socketController(io);

// OPTIONAL: global connection log
io.on(EnumSocketEvent.CONNECTION, (socket) => {
  console.log("Socket Connected:", socket.id);
});

module.exports = mainServer;
