const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const { Schema, model } = mongoose;

const ProviderSchema = new Schema(
  {
    authId: {
      type: ObjectId,
      required: true,
      ref: "Auth",
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    serviceCategory: {
      type: ObjectId,
      ref: "Category",
      required: true,
      trim: true,
    },
    subcategory: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    coveredRadius: {
      type: Number, // in kilometers
      required: true,
      min: 1,
      max: 100,
      trim: true,
    },
    workingHours: [
      {
        day: {
          type: String,
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          required: true,
          trim: true,
        },
        startTime: {
          type: String,
          required: true,
          trim: true,
        },
        endTime: {
          type: String,
          required: true,
          trim: true,
        },
        isAvailable: {
          type: Boolean,
          default: true,
        },
      },
    ],
    serviceLocation: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    licenses: [{
      type: String, // file paths
    }],
    certificates: [{
      type: String, // file paths
    }],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    pendingUpdates: {
      type: Schema.Types.Mixed,
      default: null,
    },

    potentialProviders: [{
      providerId: {
        type: ObjectId,
        ref: "Provider",
      },
      status: {
        type: String,
        enum: ["PENDING", "AWAITING_PAYMENT", "ACCEPTED", "DECLINED", "PAID"],
        default: "PENDING",
      },
      acceptedAt: Date,
      declinedAt: Date,
      paidAt: Date,
    }],
    // new fields for reservation/payment
    reservedProvider: {
      type: ObjectId,
      ref: "Provider",
      default: null,
    },
    reservedUntil: Date,
    paymentIntentId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Provider = model("Provider", ProviderSchema);
module.exports = Provider;