const  ProviderService  = require("./provider.service");
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
    message: "Update request submitted for admin approval",
    data: result,
  });
});

const toggleProviderStatus = catchAsync(async (req, res) => {
  const result = await ProviderService.toggleProviderStatus(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider status updated successfully",
    data: result,
  });
});

const getPotentialRequests = catchAsync(async (req, res) => {
  const result = await ProviderService.getPotentialRequests(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Potential requests retrieved successfully",
    data: result,
  });
});

const handleRequestResponse = catchAsync(async (req, res) => {
  const result = await ProviderService.handleRequestResponse(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Request response handled successfully",
    data: result,
  });
});

const markRequestComplete = catchAsync(async (req, res) => {
  const result = await ProviderService.markRequestComplete(req);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Request marked as completed successfully",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req, res) => {
  const result = await ProviderService.getAllProviders(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Providers retrieved successfully",
    data: result,
  });
});

const getProviderById = catchAsync(async (req, res) => {
  const result = await ProviderService.getProviderById(req.query.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider retrieved successfully",
    data: result,
  });
});

const ProviderController = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  toggleProviderStatus,
  getPotentialRequests,
  handleRequestResponse,
  markRequestComplete,
  getAllProviders,  
  getProviderById,
};

module.exports = { ProviderController };