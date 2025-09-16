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
      enum: ["PENDING", "PROCESSING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAYMENT_PENDING"],
      default: "PENDING",
    },
    assignedProvider: {
      type: ObjectId,
      ref: "Provider",
    },
    potentialProviders: [{
      providerId: {
        type: ObjectId,
        ref: "Provider",
      },
      status: {
        type: String,
        enum: ["PENDING", "ACCEPTED", "DECLINED", "PAID"],
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
    completionProof: [{
      type: String,
    }],
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