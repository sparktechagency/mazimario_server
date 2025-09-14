const { ProviderService } = require("./provider.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const registerProvider = catchAsync(async (req, res) => {
  const result = await ProviderService.registerProvider(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Provider registered successfully",
    data: result,
  });
});

const getProviderProfile = catchAsync(async (req, res) => {
  const result = await ProviderService.getProviderProfile(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider profile retrieved successfully",
    data: result,
  });
});

const updateProviderProfile = catchAsync(async (req, res) => {
  const result = await ProviderService.updateProviderProfile(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider profile updated successfully",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req, res) => {
  const result = await ProviderService.getAllProviders(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Providers retrieved successfully",
    data: result,
  });
});

const getProviderById = catchAsync(async (req, res) => {
  const result = await ProviderService.getProviderById(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider retrieved successfully",
    data: result,
  });
});

const updateProviderVerification = catchAsync(async (req, res) => {
  const result = await ProviderService.updateProviderVerification(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider verification updated successfully",
    data: result,
  });
});

const updateProviderStatus = catchAsync(async (req, res) => {
  const result = await ProviderService.updateProviderStatus(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider status updated successfully",
    data: result,
  });
});

const deleteProvider = catchAsync(async (req, res) => {
  const result = await ProviderService.deleteProvider(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider deleted successfully",
    data: result,
  });
});

const getProvidersByCategory = catchAsync(async (req, res) => {
  const result = await ProviderService.getProvidersByCategory(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Providers retrieved successfully",
    data: result,
  });
});

const ProviderController = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  getAllProviders,
  getProviderById,
  updateProviderVerification,
  updateProviderStatus,
  deleteProvider,
  getProvidersByCategory,
};

module.exports = { ProviderController };