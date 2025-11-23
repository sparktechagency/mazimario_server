const express = require("express");
const { ConversationController } = require("./conversation.controller");
const auth = require("../../middleware/auth");
const { uploadChatFiles } = require("../../middleware/fileUploader");
const config = require("../../../config");

const router = express.Router();

const uploadFields = uploadChatFiles();

// Error-handling middleware for multer uploads
const handleMulterError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: true, message: err.message || "File upload error." });
  }
  next();
};

router
  .get("/get-conversation", auth(config.auth_level.user), ConversationController.getConversation)
  .get("/get-conversation/:conversationId", auth(config.auth_level.user), ConversationController.getConversationById)
  .get("/get-conversation-list", auth(config.auth_level.user), ConversationController.getConversationList)
  .get("/check-block/:targetUserId", auth(config.auth_level.user), ConversationController.checkUserIsBlocked)
  .post("/block/:targetUserId", auth(config.auth_level.user), ConversationController.blockUser)
  .post("/unblock/:targetUserId", auth(config.auth_level.user), ConversationController.unblockUser)
  .post("/block-toggle/:conversationId", auth(config.auth_level.user), ConversationController.blockToggle)
  .post("/delete-message/:messageId", auth(config.auth_level.user), ConversationController.deleteMessage)
  .post("/chat-images-video", auth(config.auth_level.user), uploadFields, handleMulterError, ConversationController.chatImageVideo);

module.exports = router;
