const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const actorRefSchema = new Schema(
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

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: actorRefSchema,
      required: true,
    },
    receiver: {
      type: actorRefSchema,
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    video: {
      type: String,
      default: null,
    },
    videoCover: {
      type: String,
      default: null,
    },
    seen: {
      type: Boolean,
      default: false,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "messages",
  }
);

messageSchema.index({ conversationId: 1, "receiver.id": 1, seen: 1 });

const ConversationMessage = mongoose.models.ConversationMessage || model("ConversationMessage", messageSchema);

module.exports = ConversationMessage;
