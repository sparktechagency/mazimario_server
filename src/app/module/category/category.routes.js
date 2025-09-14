const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { CategoryController } = require("./category.controller");
const config = require("../../../config");

const router = express.Router();

// Public routes (no authentication required for dropdowns)
router
  .get("/active-categories", CategoryController.getActiveCategories)
  .get(
    "/subcategories-by-category",
    CategoryController.getSubcategoriesByCategory
  );

// Admin routes
router
  .post(
    "/create",
    auth(config.auth_level.admin),
    uploadFile({ name: "icon", maxCount: 1 }),
    CategoryController.createCategory
  )
  .get(
    "/get-all",
    auth(config.auth_level.admin),
    CategoryController.getAllCategories
  )
  .get(
    "/get-by-id",
    auth(config.auth_level.admin),
    CategoryController.getCategoryById
  )
  .patch(
    "/update",
    auth(config.auth_level.admin),
    uploadFile({ name: "icon", maxCount: 1 }),
    CategoryController.updateCategory
  )
  .delete(
    "/delete",
    auth(config.auth_level.admin),
    CategoryController.deleteCategory
  )
  .patch(
    "/toggle-status",
    auth(config.auth_level.admin),
    CategoryController.toggleCategoryStatus
  )
  .post(
    "/add-subcategory",
    auth(config.auth_level.admin),
    CategoryController.addSubcategory
  )
  .patch(
    "/update-subcategory",
    auth(config.auth_level.admin),
    CategoryController.updateSubcategory
  )
  .delete(
    "/delete-subcategory",
    auth(config.auth_level.admin),
    CategoryController.deleteSubcategory
  )
  .patch(
    "/toggle-subcategory-status",
    auth(config.auth_level.admin),
    CategoryController.toggleSubcategoryStatus
  );

module.exports = router;
