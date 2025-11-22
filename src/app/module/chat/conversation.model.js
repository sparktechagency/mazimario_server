const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const participantSchema = new Schema(
  {
    id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["USER", "PROVIDER", "ADMIN", "SUPER_ADMIN"],
    },
  },
  { _id: false }
);

const blockedBySchema = new Schema(
  {
    id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    participants: {
      type: [participantSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: "Conversation must have at least two participants",
      },
    },
    messages: [
      {
        type: Schema.Types.ObjectId,
        ref: "ConversationMessage",
        default: [],
      },
    ],
    blockedBy: {
      type: [blockedBySchema],
      default: [],
    },
    meta: {
      // optional extensible meta object
      lastActivityAt: Date,
    },
  },
  {
    timestamps: true,
    collection: "conversation",
  }
);

// Index to quickly query conversations by participant id
conversationSchema.index({ "participants.id": 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.models.Conversation || model("Conversation", conversationSchema);

module.exports = Conversation;
