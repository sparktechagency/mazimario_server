const express = require("express");
const { ConversationController } = require("./conversation.controller");
const { authenticateOwnerAndUser } = require("../../middleware/auth.middleware");
const upload = require("../../../utils/upload");

const router = express.Router();

const uploadFields = upload.fields([
  { name: "chatImage", maxCount: 10 },
  { name: "chatVideo", maxCount: 1 },
  { name: "chatVideoCover", maxCount: 1 },
]);

// Error-handling middleware for multer uploads
const handleMulterError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: true, message: err.message || "File upload error." });
  }
  next();
};

router
  .get("/get-conversation", authenticateOwnerAndUser, ConversationController.getConversation)
  .get("/get-conversation/:conversationId", authenticateOwnerAndUser, ConversationController.getConversationById)
  .get("/get-conversation-list", authenticateOwnerAndUser, ConversationController.getConversationList)
  .get("/check-block/:targetUserId", authenticateOwnerAndUser, ConversationController.checkUserIsBlocked)
  .post("/block/:targetUserId", authenticateOwnerAndUser, ConversationController.blockUser)
  .post("/unblock/:targetUserId", authenticateOwnerAndUser, ConversationController.unblockUser)
  .post("/block-toggle/:conversationId", authenticateOwnerAndUser, ConversationController.blockToggle)
  .post("/delete-message/:messageId", authenticateOwnerAndUser, ConversationController.deleteMessage)
  .post("/chat-images-video", authenticateOwnerAndUser, uploadFields, handleMulterError, ConversationController.chatImageVideo);

module.exports = router;
