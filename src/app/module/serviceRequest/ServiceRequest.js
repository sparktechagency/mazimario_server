const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const { Schema, model } = mongoose;

const ServiceRequestSchema = new Schema(
  {
    customerId: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    serviceCategory: {
      type: ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "Urgent"],
      default: "Normal",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
    attachments: [{
      type: String,
    }],
    status: {
      type: String,
      enum: [
        "PENDING",      // Just created, awaiting matching
        "MATCHED",      // Providers found and notified
        "PURCHASED",    // At least one provider purchased
        "ASSIGNED",     // Provider accepted and working
        "IN_PROGRESS",  // Service being performed
        "COMPLETED",    // Provider submitted completion proof
        "APPROVED",     // Customer approved
        "DISPUTED",     // Customer disputed
        "CANCELLED",    // Customer cancelled
        "EXPIRED"       // Expired without purchase
      ],
      default: "PENDING",
    },
    // New fields for payment workflow
    leadPrice: {
      type: Number,
      required: true,
      default: 500 // $5.00 in cents
    },
    currency: {
      type: String,
      default: "USD"
    },
    expiresAt: {
      type: Date,
      // required: true // Make optional initially to avoid breaking existing requests
    },
    purchasedBy: [{
      provider: {
        type: ObjectId,
        ref: "Provider"
      },
      purchaseId: {
        type: ObjectId,
        ref: "LeadPurchase"
      },
      purchasedAt: Date
    }],
    maxProviders: {
      type: Number,
      default: 5
    },
    assignedProvider: {
      type: ObjectId,
      ref: "Provider",
    },
    // Provider offers/proposals system
    offers: [{
      provider: {
        type: ObjectId,
        ref: "Provider",
        required: true
      },
      proposedPrice: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: "USD"
      },
      estimatedDuration: {
        type: String,  // "2-3 days"
        required: true
      },
      message: {
        type: String,  // Provider's pitch
        maxlength: 1000
      },
      submittedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ["PENDING", "ACCEPTED", "REJECTED"],
        default: "PENDING"
      }
    }],
    // Agreed price when customer accepts offer
    agreedPrice: {
      type: Number
    },
    potentialProviders: [{
      providerId: {
        type: ObjectId,
        ref: "Provider",
      },
      status: {
        type: String,
        enum: ["PENDING", "AWAITING_PAYMENT", "ACCEPTED", "DECLINED", "PAID", "COMPLETED"],
        default: "PENDING",
      },
      acceptedAt: Date,
      declinedAt: Date,
      paidAt: Date,
    }],
    requestId: {
      type: String,
      unique: true,
    },
    leadFee: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
    },
    reviewedAt: {
      type: Date,
    },
    // Completion tracking
    completionProof: [{
      url: String,
      type: {
        type: String,
        enum: ["image", "video"]
      },
      uploadedAt: Date,
      size: Number,
      mimeType: String,
      thumbnailUrl: String
    }],
    completedAt: Date,
    completedBy: {
      type: ObjectId,
      ref: "Provider"
    },
    providerNotes: String,

    // Auto-approval
    autoApprovalAt: Date,

    // Review tracking
    isReviewed: {
      type: Boolean,
      default: false
    },
    reviewId: {
      type: ObjectId,
      ref: "Review"
    },

    // Validation
    isSpam: {
      type: Boolean,
      default: false
    },
    spamScore: Number,
    validatedAt: Date,
  },
  {
    timestamps: true,
  }
);

ServiceRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.requestId = `TZ${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

const ServiceRequest = model("ServiceRequest", ServiceRequestSchema);
module.exports = ServiceRequest;