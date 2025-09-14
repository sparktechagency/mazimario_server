const { default: status } = require("http-status");
const Category = require("./Category");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const unlinkFile = require("../../../util/unlinkFile");

// Create Category
const createCategory = async (req) => {
  const { files, body: data, user } = req;
  
  validateFields(data, ["name"]);
  validateFields(files, ["icon"]); 

  // Check if category already exists
  const existingCategory = await Category.findOne({ 
    name: { $regex: new RegExp(`^${data.name}$`, 'i') } 
  });
  if (existingCategory) {
    throw new ApiError(status.BAD_REQUEST, "Category already exists");
  }

  const categoryData = {
    name: data.name,
    icon: files.icon[0].path,
    createdBy: user.authId,
  };

  return await Category.create(categoryData);
};

// Get All Categories with Subcategory Count
const getAllCategories = async (query) => {
  const categoryQuery = new QueryBuilder(
    Category.find({})
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean(),
    query
  )
    .search(["name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [categories, meta] = await Promise.all([
    categoryQuery.modelQuery,
    categoryQuery.countTotal(),
  ]);

  // Add subcategory count to each category
  const categoriesWithCount = categories.map(category => ({
    _id: category._id,
    name: category.name,
    image: category.image,
    icon: category.icon,
    isActive: category.isActive,
    subcategoryCount: category.subcategories.filter(sub => sub.isActive).length,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  }));

  return { meta, categories: categoriesWithCount };
};

// Get Single Category
const getCategoryById = async (query) => {
  validateFields(query, ["categoryId"]);

  const category = await Category.findById(query.categoryId)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  return {
    _id: category._id,
    name: category.name,
    image: category.image,
    icon: category.icon,
    isActive: category.isActive,
    subcategories: category.subcategories.filter(sub => sub.isActive),
    subcategoryCount: category.subcategories.filter(sub => sub.isActive).length,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
};

// Update Category
const updateCategory = async (req) => {
  const { files, body: data, user } = req;
  validateFields(data, ["categoryId"]);

  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  // Check if name already exists
  if (data.name && data.name !== category.name) {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, 'i') },
      _id: { $ne: data.categoryId }
    });
    if (existingCategory) {
      throw new ApiError(status.BAD_REQUEST, "Category name already exists");
    }
  }

  const updateData = {
    ...(data.name && { name: data.name }),
    updatedBy: user.authId,
  };

  // Handle icon update
  if (files && files.icon) {
    if (category.icon) unlinkFile(category.icon);
    updateData.icon = files.icon[0].path;
  }

  return await Category.findByIdAndUpdate(
    data.categoryId,
    updateData,
    { new: true, runValidators: true }
  ).populate("createdBy", "name email").populate("updatedBy", "name email");
};

// Delete Category
const deleteCategory = async (payload) => {
  validateFields(payload, ["categoryId"]);

  const category = await Category.findById(payload.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  // Check if category has active subcategories
  const activeSubcategories = category.subcategories.filter(sub => sub.isActive);
  if (activeSubcategories.length > 0) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Cannot delete category with active subcategories"
    );
  }

  // Delete the icon files
  if (category.icon) unlinkFile(category.icon);

  await Category.findByIdAndDelete(payload.categoryId);
  return { message: "Category deleted successfully" };
};

// Toggle Category Status
const toggleCategoryStatus = async (payload) => {
  validateFields(payload, ["categoryId", "isActive"]);

  const category = await Category.findByIdAndUpdate(
    payload.categoryId,
    { isActive: payload.isActive },
    { new: true, runValidators: true }
  ).populate("createdBy", "name email").populate("updatedBy", "name email");

  if (!category) throw new ApiError(status.NOT_FOUND, "Category not found");
  return category;
};

// Add Subcategory
const addSubcategory = async (req) => {
  const { body: data, user } = req;
  validateFields(data, ["categoryId", "name"]);

  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  // Check if subcategory already exists
  const existingSubcategory = category.subcategories.find(
    sub => sub.name.toLowerCase() === data.name.toLowerCase()
  );
  if (existingSubcategory) {
    throw new ApiError(status.BAD_REQUEST, "Subcategory already exists");
  }

  const newSubcategory = {
    name: data.name,
    createdBy: user.authId,
  };

  category.subcategories.push(newSubcategory);
  await category.save();

  return await Category.findById(data.categoryId)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
};

// Update Subcategory
const updateSubcategory = async (req) => {
  const { body: data, user } = req;
  validateFields(data, ["categoryId", "subcategoryId", "name"]);

  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  const subcategory = category.subcategories.id(data.subcategoryId);
  if (!subcategory) {
    throw new ApiError(status.NOT_FOUND, "Subcategory not found");
  }

  // Check if name already exists (excluding current subcategory)
  if (data.name && data.name !== subcategory.name) {
    const nameExists = category.subcategories.some(
      sub => sub.name.toLowerCase() === data.name.toLowerCase() && 
             sub._id.toString() !== data.subcategoryId
    );
    if (nameExists) {
      throw new ApiError(status.BAD_REQUEST, "Subcategory name already exists");
    }
  }

  subcategory.name = data.name;
  subcategory.updatedBy = user.authId;
  subcategory.updatedAt = new Date();

  await category.save();
  return await Category.findById(data.categoryId)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
};

// Delete Subcategory
const deleteSubcategory = async (payload) => {
  validateFields(payload, ["categoryId", "subcategoryId"]);

  const category = await Category.findById(payload.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  const subcategoryIndex = category.subcategories.findIndex(
    sub => sub._id.toString() === payload.subcategoryId
  );
  
  if (subcategoryIndex === -1) {
    throw new ApiError(status.NOT_FOUND, "Subcategory not found");
  }

  category.subcategories.splice(subcategoryIndex, 1);
  await category.save();

  return { message: "Subcategory deleted successfully" };
};

// Toggle Subcategory Status
const toggleSubcategoryStatus = async (payload) => {
  validateFields(payload, ["categoryId", "subcategoryId", "isActive"]);

  const category = await Category.findById(payload.categoryId);
  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  const subcategory = category.subcategories.id(payload.subcategoryId);
  if (!subcategory) {
    throw new ApiError(status.NOT_FOUND, "Subcategory not found");
  }

  subcategory.isActive = payload.isActive;
  subcategory.updatedAt = new Date();
  await category.save();

  return await Category.findById(payload.categoryId)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
};

// Get Active Categories for Dropdown
const getActiveCategories = async () => {
  const categories = await Category.find({ isActive: true })
    .select('name image icon')
    .sort({ name: 1 })
    .lean();

  return categories;
};

// Get Subcategories by Category ID for Dropdown
const getSubcategoriesByCategory = async (categoryId) => {
  validateFields({ categoryId }, ["categoryId"]);

  const category = await Category.findById(categoryId)
    .select('subcategories')
    .lean();

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  // Filter only active subcategories
  const activeSubcategories = category.subcategories
    .filter(sub => sub.isActive)
    .map(sub => ({
      _id: sub._id,
      name: sub.name
    }));

  return activeSubcategories;
};

module.exports = {
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