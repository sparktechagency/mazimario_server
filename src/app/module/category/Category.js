const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const { Schema, model } = mongoose;

// Subcategory Schema (embedded document)
const SubcategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: ObjectId,
    ref: "Auth",
    required: true,
  },
  updatedBy: {
    type: ObjectId,
    ref: "Auth",
  },
}, {
  timestamps: true,
});

// Main Category Schema
const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    icon: {
      type: String, // New field for category icon
      //   required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    price: {
      type: Number,
      default: 0,
      required: true
    },
    subcategories: [SubcategorySchema], // Embedded subcategories
    createdBy: {
      type: ObjectId,
      ref: "Auth",
      required: true,
    },
    updatedBy: {
      type: ObjectId,
      ref: "Auth",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CategorySchema.index({ name: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ "subcategories.name": 1 });

const Category = model("Category", CategorySchema);
module.exports = Category;