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
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      default: ""
    },
    serviceCategories: [{
      type: ObjectId,
      ref: "Category",
      trim: true,
    }],
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    coveredRadius: {
      type: Number, // in kilometers
      min: 1,
      max: 100,
      trim: true,
    },
    workingHours: [
      {
        day: {
          type: String,
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          trim: true,
        },
        startTime: {
          type: String,
          trim: true,
        },
        endTime: {
          type: String,
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
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isRejected: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    attachments: [{
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
    profile_image: {
      type: String,
      default: null,
    },
    // KYC/Business Verification
    businessVerification: {
      status: {
        type: String,
        enum: ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"],
        default: "NOT_STARTED"
      },
      businessName: String,
      businessType: {
        type: String,
        enum: ["INDIVIDUAL", "LLC", "CORPORATION", "PARTNERSHIP"]
      },
      taxId: String, // Should be encrypted in real app
      businessAddress: String,
      businessPhone: String,
      verifiedAt: Date,
      documents: [{
        type: { type: String }, // e.g., 'LICENSE', 'ID'
        url: String
      }]
    },
    // Payment Stats
    totalLeadsPurchased: {
      type: Number,
      default: 0
    },
    totalSpentOnLeads: {
      type: Number,
      default: 0
    },
    totalServicesCompleted: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
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

ProviderSchema.index({ authId: 1 }, { unique: true });

const Provider = model("Provider", ProviderSchema);
module.exports = Provider;