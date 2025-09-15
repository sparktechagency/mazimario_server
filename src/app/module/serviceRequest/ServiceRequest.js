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
      type: String, // Changed from ObjectId ref to String
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
      type: String,
    },
    longitude: {
      type: String,
    },
    description: {
      type: String,
    },
    attachments: [{
      type: String, // file paths
    }],
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    assignedProvider: {
      type: ObjectId,
      ref: "Provider",
    },
    requestId: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate request ID before saving
ServiceRequestSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.requestId = `TZ${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

const ServiceRequest = model("ServiceRequest", ServiceRequestSchema);

module.exports = ServiceRequest;