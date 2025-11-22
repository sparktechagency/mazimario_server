const catchAsync = require("../../../util/catchAsync");
const { ApiError } = require("../../../errors/errorHandler");
const { HTTP_STATUS } = require("../../../util/enum");
const Conversation = require("./conversation.model");
const Message = require("./message.model");
const User = require("../user/User");
const Provider = require("../provider/Provider");
const Admin = require("../admin/Admin");
const SuperAdmin = require("../superAdmin/SuperAdmin");
const mongoose = require("mongoose");

/**
 * Helper to resolve profile by role & id.
 * Returns minimal { _id, name, profilePic, role } or null.
 */
async function findProfile(id, role) {
  if (!id) return null;
  role = (role || "").toUpperCase();
  try {
    switch (role) {
      case "USER":
        return await User.findById(id).select("name profilePic role").lean();
      case "PROVIDER":
        return await Provider.findById(id).select("name profilePic role").lean();
      case "ADMIN":
        return await Admin.findById(id).select("name profilePic role").lean();
      case "SUPER_ADMIN":
        return await SuperAdmin.findById(id).select("name profilePic role").lean();
      default:
        return (
          (await User.findById(id).select("name profilePic role").lean()) ||
          (await Provider.findById(id).select("name profilePic role").lean()) ||
          (await Admin.findById(id).select("name profilePic role").lean()) ||
          (await SuperAdmin.findById(id).select("name profilePic role").lean())
        );
    }
  } catch (e) {
    return null;
  }
}

// GET single conversation between authenticated user and partnerId
const getConversation = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { partnerId, partnerRole, page = 1, limit = 20 } = req.query;

    if (!partnerId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Missing partner ID.");
    }

    // find conversation where both participant ids exist
    const conversation = await Conversation.findOne({
      "participants.id": { $all: [mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(partnerId)] }
    })
      .lean();

    if (!conversation) {
      // return partner profile for UI convenience
      const partner = await findProfile(partnerId, partnerRole);
      return res.status(200).json({
        status: true,
        conversation: null,
        message: "No message history",
        participant: partner,
      });
    }

    // paginate messages manually
    const skip = (Number(page) - 1) * Number(limit);
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // populate sender/receiver per message
    const populatedMessages = await Promise.all(messages.map(async (m) => {
      const sender = await findProfile(m.sender.id, m.sender.role) || { _id: m.sender.id };
      const receiver = await findProfile(m.receiver.id, m.receiver.role) || { _id: m.receiver.id };
      return { ...m, sender, receiver };
    }));

    conversation.messages = populatedMessages;

    // find the partner object in participants
    const partnerObj = conversation.participants.find(p => p.id.toString() !== userId.toString());
    const partner = partnerObj ? await findProfile(partnerObj.id, partnerObj.role) : null;

    const isBlockedByYou = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    const isBlockedByPartner = partnerObj ? conversation.blockedBy.some(b => b.id.toString() === partnerObj.id.toString()) : false;

    res.status(200).json({
      status: true,
      conversation,
      message: "Fetched message history",
      participant: partner,
      blockStatus: {
        isBlockedByYou,
        isBlockedByPartner,
        isBlocked: isBlockedByYou || isBlockedByPartner,
      },
    });
  } catch (error) {
    console.error("getConversation error:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
});

// GET conversation list (inbox) for authenticated user
const getConversationList = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const baseQuery = { "participants.id": mongoose.Types.ObjectId(userId) };

    const conversations = await Conversation.find(baseQuery)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    if (!conversations || conversations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 1,
          totalConversations: 0,
        },
      });
    }

    const conversationIds = conversations.map(c => c._id);
    // get latest message per conversation
    const lastMessages = await Message.aggregate([
      { $match: { conversationId: { $in: conversationIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", doc: { $first: "$$ROOT" } } }
    ]);

    const lastMessageMap = {};
    lastMessages.forEach(l => lastMessageMap[l._id.toString()] = l.doc);

    const processed = await Promise.all(conversations.map(async (conv) => {
      // identify other participant
      const other = conv.participants.find(p => p.id.toString() !== userId.toString());
      if (!other) return null;
      // apply search filter if needed
      const otherProfile = await findProfile(other.id, other.role);
      if (search && otherProfile && !otherProfile.name?.toLowerCase().includes(search.toLowerCase())) {
        return null;
      }

      const lastMsg = lastMessageMap[conv._id.toString()] || null;
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        "receiver.id": mongoose.Types.ObjectId(userId),
        seen: false
      });

      return {
        conversationId: conv._id,
        blockedBy: conv.blockedBy,
        participants: [
          { id: userId }, // minimized current user info; frontend may request full profile
          {
            id: other.id,
            name: otherProfile?.name || "Unknown",
            profileImage: otherProfile?.profilePic || null,
            role: other.role,
          }
        ],
        lastMessage: lastMsg,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    }));

    const valid = processed.filter(Boolean);
    const totalConversations = await Conversation.countDocuments(baseQuery);

    res.status(200).json({
      success: true,
      data: valid,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalConversations / Number(limit)),
        totalConversations,
      },
    });
  } catch (error) {
    console.error("getConversationList error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const blockUser = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;
    const { targetUserRole = "USER" } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself." });
    }

    let conversation = await Conversation.findOne({
      "participants.id": { $all: [mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(targetUserId)] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [
          { id: mongoose.Types.ObjectId(userId), role: req.user.role || "USER" },
          { id: mongoose.Types.ObjectId(targetUserId), role: targetUserRole }
        ],
        messages: []
      });
    }

    if (conversation.blockedBy.some(b => b.id.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: "You have already blocked this user." });
    }

    conversation.blockedBy.push({ id: mongoose.Types.ObjectId(userId), role: req.user.role || "USER" });
    await conversation.save();

    res.status(200).json({ success: true, message: "User blocked successfully.", blocked: true });
  } catch (error) {
    console.error("blockUser error:", error);
    res.status(500).json({ success: false, message: "Server error while blocking user." });
  }
});

const unblockUser = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    const conversation = await Conversation.findOne({
      "participants.id": { $all: [mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(targetUserId)] }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "No conversation found with this user." });
    }

    const wasBlocked = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    if (!wasBlocked) {
      return res.status(400).json({ success: false, message: "You have not blocked this user." });
    }

    conversation.blockedBy = conversation.blockedBy.filter(b => b.id.toString() !== userId.toString());
    await conversation.save();

    res.status(200).json({ success: true, message: "User unblocked successfully.", blocked: false });
  } catch (error) {
    console.error("unblockUser error:", error);
    res.status(500).json({ success: false, message: "Server error while unblocking user." });
  }
});

const checkUserIsBlocked = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    if (userId === targetUserId) {
      return res.status(200).json({
        success: true,
        isBlockedByYou: false,
        isBlockedByThem: false,
        canMessage: true,
        message: "Self-check - always allowed"
      });
    }

    const conversation = await Conversation.findOne({
      "participants.id": { $all: [mongoose.Types.ObjectId(userId), mongoose.Types.ObjectId(targetUserId)] }
    });

    if (!conversation) {
      return res.status(200).json({
        success: true,
        isBlockedByYou: false,
        isBlockedByThem: false,
        canMessage: true,
        message: "No conversation exists - messaging allowed"
      });
    }

    const isBlockedByYou = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    const isBlockedByThem = conversation.blockedBy.some(b => b.id.toString() === targetUserId.toString());
    const canMessage = !isBlockedByYou && !isBlockedByThem;

    let message = "Messaging allowed";
    if (isBlockedByYou && isBlockedByThem) message = "Both users have blocked each other";
    else if (isBlockedByYou) message = "You have blocked this user";
    else if (isBlockedByThem) message = "This user has blocked you";

    res.status(200).json({
      success: true,
      isBlockedByYou,
      isBlockedByThem,
      canMessage,
      message
    });
  } catch (error) {
    console.error("checkUserIsBlocked error:", error);
    res.status(500).json({ success: false, message: "Server error while checking block status." });
  }
});

const blockToggle = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    const isParticipant = conversation.participants.some(p => p.id.toString() === userId.toString());
    if (!isParticipant) return res.status(403).json({ message: "You are not a participant in this conversation." });

    const isBlocked = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    if (isBlocked) {
      conversation.blockedBy = conversation.blockedBy.filter(b => b.id.toString() !== userId.toString());
      await conversation.save();
      return res.status(200).json({ success: true, message: "Conversation unblocked successfully.", blocked: false, conversationId: conversation._id });
    } else {
      conversation.blockedBy.push({ id: mongoose.Types.ObjectId(userId), role: req.user.role || "USER" });
      await conversation.save();
      return res.status(200).json({ success: true, message: "Conversation blocked successfully.", blocked: true, conversationId: conversation._id });
    }
  } catch (error) {
    console.error("blockToggle error:", error);
    res.status(500).json({ success: false, message: "Server error please try again!" });
  }
});

// upload endpoint (returns uploaded file URLs). Keep your existing upload middleware.
// This function expects multer to have processed files as in your original code.
const chatImageVideo = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;

    const images = req.files?.chatImage || [];
    const video = req.files?.chatVideo?.[0] || null;
    const videoCover = req.files?.chatVideoCover?.[0] || null;

    const uploadedImages = images.map((f) => f.location || f.key || f.path).filter(Boolean);
    const uploadedVideo = video ? video.location || video.key || video.path : null;
    const uploadedVideoCover = videoCover ? videoCover.location || videoCover.key || videoCover.path : null;

    return res.status(200).json({
      success: true,
      images: uploadedImages,
      video: uploadedVideo,
      cover: uploadedVideoCover,
    });
  } catch (error) {
    console.error("chatImageVideo error:", error);
    res.status(500).json({ success: false, message: "File Upload Error" });
  }
});

const deleteMessage = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });

    // ensure sender matches
    if (message.sender.id.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this message" });
    }

    await Message.deleteOne({ _id: messageId });

    // remove reference from conversation
    await Conversation.updateOne({ _id: message.conversationId }, { $pull: { messages: message._id } });

    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("deleteMessage error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const getConversationById = catchAsync(async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!conversationId) return res.status(400).json({ success: false, message: "Missing conversation id" });

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const populatedMessages = await Promise.all(messages.map(async (message) => {
      const sender = await findProfile(message.sender.id, message.sender.role);
      const receiver = await findProfile(message.receiver.id, message.receiver.role);
      return { ...message, sender, receiver };
    }));

    conversation.messages = populatedMessages;

    const otherIdObj = conversation.participants.find(p => p.id.toString() !== userId.toString());
    const partner = otherIdObj ? await findProfile(otherIdObj.id, otherIdObj.role) : null;

    const isBlockedByYou = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    const isBlockedByPartner = otherIdObj ? conversation.blockedBy.some(b => b.id.toString() === otherIdObj.id.toString()) : false;

    return res.status(200).json({
      success: true,
      conversation,
      participant: partner,
      blockStatus: {
        isBlockedByYou,
        isBlockedByPartner,
        isBlocked: isBlockedByYou || isBlockedByPartner,
      },
    });
  } catch (error) {
    console.error("getConversationById error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const ConversationController = {
  getConversation,
  getConversationList,
  blockUser,
  unblockUser,
  checkUserIsBlocked,
  blockToggle,
  chatImageVideo,
  deleteMessage,
  getConversationById,
};

module.exports = { ConversationController };
