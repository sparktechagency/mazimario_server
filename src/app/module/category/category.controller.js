const CategoryService = require("./category.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

// Create Category
const createCategory = catchAsync(async (req, res) => {
  const result = await CategoryService.createCategory(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

// Get All Categories (Admin)
const getAllCategories = catchAsync(async (req, res) => {
  const result = await CategoryService.getAllCategories(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Categories retrieved successfully",
    data: result,
  });
});

// Get Single Category
const getCategoryById = catchAsync(async (req, res) => {
  const result = await CategoryService.getCategoryById(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category retrieved successfully",
    data: result,
  });
});

// Update Category
const updateCategory = catchAsync(async (req, res) => {
  const result = await CategoryService.updateCategory(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

// Delete Category
const deleteCategory = catchAsync(async (req, res) => {
  const result = await CategoryService.deleteCategory(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

// Toggle Category Status
const toggleCategoryStatus = catchAsync(async (req, res) => {
  const result = await CategoryService.toggleCategoryStatus(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category status updated successfully",
    data: result,
  });
});

// Add Subcategory
const addSubcategory = catchAsync(async (req, res) => {
  const result = await CategoryService.addSubcategory(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Subcategory added successfully",
    data: result,
  });
});

// Update Subcategory
const updateSubcategory = catchAsync(async (req, res) => {
  const result = await CategoryService.updateSubcategory(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subcategory updated successfully",
    data: result,
  });
});

// Delete Subcategory
const deleteSubcategory = catchAsync(async (req, res) => {
  const result = await CategoryService.deleteSubcategory(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subcategory deleted successfully",
    data: result,
  });
});

// Toggle Subcategory Status
const toggleSubcategoryStatus = catchAsync(async (req, res) => {
  const result = await CategoryService.toggleSubcategoryStatus(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subcategory status updated successfully",
    data: result,
  });
});

// Get Active Categories for Dropdown
const getActiveCategories = catchAsync(async (req, res) => {
  const result = await CategoryService.getActiveCategories();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Active categories retrieved successfully",
    data: result,
  });
});

// Get Subcategories by Category for Dropdown
const getSubcategoriesByCategory = catchAsync(async (req, res) => {
  const result = await CategoryService.getSubcategoriesByCategory(req.query.categoryId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subcategories retrieved successfully",
    data: result,
  });
});

const CategoryController = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  toggleSubcategoryStatus,
  getActiveCategories,
  getSubcategoriesByCategory,
};

module.exports = { CategoryController };