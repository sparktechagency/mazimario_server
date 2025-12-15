const catchAsync = require("../../../util/catchAsync");
const ApiError = require("../../../error/ApiError");
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
 * Returns { _id, name, email, profilePic (or profile_image), role } or null.
 */
async function findProfile(id, role) {
  if (!id) return null;
  role = (role || "").toUpperCase();
  try {
    switch (role) {
      case "USER": {
        const user = await User.findById(id).select("name email profile_image role").lean();
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          profilePic: user.profile_image || null,
          role: user.role || "USER"
        };
      }
      case "PROVIDER": {
        const provider = await Provider.findById(id).populate("authId", "name email role").select("profile_image").lean();
        if (!provider || !provider.authId) return null;
        // console.log("provider.profile_image", provider);
        return {
          _id: provider._id,
          name: provider.authId.name || null,
          email: provider.authId.email || null,
          profilePic: provider.profile_image || null,
          role: provider.role || "PROVIDER"
        };
      }
      case "ADMIN": {
        const admin = await Admin.findById(id).populate("authId", "name email role").select("profile_image").lean();
        if (!admin || !admin.authId) return null;
        return {
          _id: admin._id,
          name: admin.authId.name || null,
          email: admin.authId.email || null,
          profilePic: admin.profile_image || null,
          role: admin.role || "ADMIN"
        };
      }
      case "SUPER_ADMIN": {
        const superAdmin = await SuperAdmin.findById(id).populate("authId", "name email role").select("profile_image").lean();
        if (!superAdmin || !superAdmin.authId) return null;
        return {
          _id: superAdmin._id,
          name: superAdmin.authId.name || null,
          email: superAdmin.authId.email || null,
          profilePic: superAdmin.profile_image || null,
          role: superAdmin.role || "SUPER_ADMIN"
        };
      }
      default: {
        // Try all roles
        const user = await User.findById(id).select("name email profile_image role").lean();
        if (user) {
          return {
            _id: user._id,
            name: user.name,
            email: user.email,
            profilePic: user.profile_image || null,
            role: user.role || "USER"
          };
        }
        const provider = await Provider.findById(id).populate("authId", "name email role").select("profile_image").lean();
        if (provider && provider.authId) {
          return {
            _id: provider._id,
            name: provider.authId.name || null,
            email: provider.authId.email || null,
            profilePic: provider.profile_image || null,
            role: provider.role || "PROVIDER"
          };
        }
        return null;
      }
    }
  } catch (e) {
    console.error("findProfile error:", e);
    return null;
  }
}

// GET single conversation between authenticated user and partnerId
const getConversation = catchAsync(async (req, res) => {
  try {
    const userId = req.user.userId;
    const { partnerId, partnerRole, page = 1, limit = 20 } = req.query;

    if (!partnerId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Missing partner ID.");
    }

    // find conversation
    const conversation = await Conversation.findOne({
      "participants.id": {
        $all: [
          new mongoose.Types.ObjectId(userId),
          new mongoose.Types.ObjectId(partnerId)
        ]
      }
    }).lean();

    if (!conversation) {
      const partner = await findProfile(partnerId, partnerRole);
      return res.status(200).json({
        status: true,
        conversation: null,
        message: "No message history",
        participant: partner,
      });
    }

    // paginate
    const skip = (Number(page) - 1) * Number(limit);
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // --- Populate messages with sender + receiver (like getConversationList) ---
    const populatedMessages = await Promise.all(
      messages.map(async (m) => {
        const [senderProfile, receiverProfile] = await Promise.all([
          findProfile(m.sender.id, m.sender.role),
          findProfile(m.receiver.id, m.receiver.role),
        ]);

        return {
          ...m,
          sender: {
            id: m.sender.id,
            role: m.sender.role,
            name: senderProfile?.name || null,
            email: senderProfile?.email || null,
            profileImage: senderProfile?.profilePic || null
          },
          receiver: {
            id: m.receiver.id,
            role: m.receiver.role,
            name: receiverProfile?.name || null,
            email: receiverProfile?.email || null,
            profileImage: receiverProfile?.profilePic || null
          }
        };
      })
    );

    conversation.messages = populatedMessages;

    // --- Populate participants exactly like getConversationList ---
    const enrichedParticipants = await Promise.all(
      conversation.participants.map(async (p) => {
        const profile = await findProfile(p.id, p.role);

        return {
          id: p.id,
          name: profile?.name || "Unknown",
          email: profile?.email || null,
          profileImage: profile?.profilePic || null,
          role: p.role
        };
      })
    );

    conversation.participants = enrichedParticipants;

    // partner profile for UI
    const partnerObj = enrichedParticipants.find(p => p.id.toString() !== userId.toString());
    const partner = partnerObj || null;

    // block status
    const isBlockedByYou = conversation.blockedBy.some(b => b.id.toString() === userId.toString());
    const isBlockedByPartner = partnerObj
      ? conversation.blockedBy.some(b => b.id.toString() === partnerObj.id.toString())
      : false;

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
    const userId = req.user.userId;
    console.log(req.user);
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const baseQuery = { "participants.id": new mongoose.Types.ObjectId(userId) };

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

    // Get current user profile once (reuse across all conversations)
    const currentUserProfile = await findProfile(userId, req.user.role);

    const processed = await Promise.all(conversations.map(async (conv) => {
      // identify other participant
      const other = conv.participants.find(p => p.id.toString() !== userId.toString());
      if (!other) return null;

      // Get current user participant for this conversation
      const currentParticipant = conv.participants.find(p => p.id.toString() === userId.toString());

      // apply search filter if needed
      const otherProfile = await findProfile(other.id, other.role);
      if (search && otherProfile && !otherProfile.name?.toLowerCase().includes(search.toLowerCase())) {
        return null;
      }

      const lastMsgRaw = lastMessageMap[conv._id.toString()] || null;

      // Populate last message sender and receiver profiles
      let lastMessage = null;
      if (lastMsgRaw) {
        const [senderProfile, receiverProfile] = await Promise.all([
          findProfile(lastMsgRaw.sender?.id, lastMsgRaw.sender?.role),
          findProfile(lastMsgRaw.receiver?.id, lastMsgRaw.receiver?.role)
        ]);

        lastMessage = {
          ...lastMsgRaw,
          sender: {
            ...lastMsgRaw.sender,
            name: senderProfile?.name || null,
            email: senderProfile?.email || null,
            profilePic: senderProfile?.profilePic || null
          },
          receiver: {
            ...lastMsgRaw.receiver,
            name: receiverProfile?.name || null,
            email: receiverProfile?.email || null,
            profilePic: receiverProfile?.profilePic || null
          }
        };
      }

      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        "receiver.id": new mongoose.Types.ObjectId(userId),
        seen: false
      });

      return {
        conversationId: conv._id,
        blockedBy: conv.blockedBy,
        participants: [
          {
            id: userId,
            name: currentUserProfile?.name || null,
            email: currentUserProfile?.email || null,
            profileImage: currentUserProfile?.profilePic || null,
            role: currentParticipant?.role || req.user.role
          },
          {
            id: other.id,
            name: otherProfile?.name || "Unknown",
            email: otherProfile?.email || null,
            profileImage: otherProfile?.profilePic || null,
            role: other.role,
          }
        ],
        lastMessage,
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
    const userId = req.user.userId;
    console.log(userId);
    const { targetUserId } = req.params;
    const { targetUserRole = "USER" } = req.body || {};

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself." });
    }

    let conversation = await Conversation.findOne({
      "participants.id": { $all: [new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(targetUserId)] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [
          { id: new mongoose.Types.ObjectId(userId), role: req.user.role || "USER" },
          { id: new mongoose.Types.ObjectId(targetUserId), role: targetUserRole }
        ],
        messages: []
      });
    }

    if (conversation.blockedBy.some(b => b.id.toString() === userId.toString())) {
      return res.status(400).json({ success: false, message: "You have already blocked this user." });
    }

    conversation.blockedBy.push({ id: new mongoose.Types.ObjectId(userId), role: req.user.role || "USER" });
    await conversation.save();

    res.status(200).json({ success: true, message: "User blocked successfully.", blocked: true });
  } catch (error) {
    console.error("blockUser error:", error);
    res.status(500).json({ success: false, message: "Server error while blocking user." });
  }
});

const unblockUser = catchAsync(async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(userId);
    const { targetUserId } = req.params;

    const conversation = await Conversation.findOne({
      "participants.id": { $all: [new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(targetUserId)] }
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
    const userId = req.user.userId;
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
      "participants.id": { $all: [new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(targetUserId)] }
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
    const userId = req.user.userId;
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
      conversation.blockedBy.push({ id: new mongoose.Types.ObjectId(userId), role: req.user.role || "USER" });
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
    const userId = req.user.userId;

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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Missing conversation id"
      });
    }

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    // ---- Fetch & Populate Messages ----
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const populatedMessages = await Promise.all(
      messages.map(async (msg) => {
        const [senderProfile, receiverProfile] = await Promise.all([
          findProfile(msg.sender.id, msg.sender.role),
          findProfile(msg.receiver.id, msg.receiver.role),
        ]);

        return {
          ...msg,
          sender: {
            id: msg.sender.id,
            role: msg.sender.role,
            name: senderProfile?.name || null,
            email: senderProfile?.email || null,
            profileImage: senderProfile?.profilePic || null,
          },
          receiver: {
            id: msg.receiver.id,
            role: msg.receiver.role,
            name: receiverProfile?.name || null,
            email: receiverProfile?.email || null,
            profileImage: receiverProfile?.profilePic || null,
          }
        };
      })
    );

    conversation.messages = populatedMessages;

    // ---- Populate Participants Exactly Like getConversationList ----
    const populatedParticipants = await Promise.all(
      conversation.participants.map(async (p) => {
        const profile = await findProfile(p.id, p.role);
        return {
          id: p.id,
          name: profile?.name || "Unknown",
          email: profile?.email || null,
          profileImage: profile?.profilePic || null,
          role: p.role
        };
      })
    );

    conversation.participants = populatedParticipants;

    // Identify Partner
    const partner = populatedParticipants.find((p) => p.id.toString() !== userId.toString()) || null;

    // ---- Block Status ----
    const isBlockedByYou = conversation.blockedBy.some((b) => b.id.toString() === userId.toString());
    const isBlockedByPartner = partner
      ? conversation.blockedBy.some((b) => b.id.toString() === partner.id.toString())
      : false;

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
    res.status(500).json({
      success: false,
      message: "Server error"
    });
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
