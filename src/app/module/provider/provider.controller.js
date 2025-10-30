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

const getPotentialRequestById = catchAsync(async (req, res) => {
  const result = await ProviderService.getPotentialRequestById(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Potential request retrieved successfully",
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

const verifyProvider = catchAsync(async (req, res) => {
  const result = await ProviderService.verifyProvider(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Provider ${req.body.isVerified ? 'verified' : 'unverified'} successfully`,
    data: result,
  });
});

const updateLiscence = catchAsync(async (req, res) => {
  const result = await ProviderService.updateLiscence(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Liscence updated successfully",
    data: result,
  });
});

// Get Providers with Pending Updates (Admin)
const getPendingProviderUpdates = catchAsync(async (req, res) => {
  const result = await ProviderService.getPendingProviderUpdates();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending provider updates retrieved successfully",
    data: result,
  });
});

// Approve Provider Update (Admin)
const approveProviderUpdate = catchAsync(async (req, res) => {
  const result = await ProviderService.approveProviderUpdate(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result.provider,
  });
});

// Reject Provider Update (Admin)
const rejectProviderUpdate = catchAsync(async (req, res) => {
  const result = await ProviderService.rejectProviderUpdate(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

const ProviderController = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  toggleProviderStatus,
  getPotentialRequests,
  getPotentialRequestById,
  handleRequestResponse,
  markRequestComplete,
  getAllProviders,  
  getProviderById,
  verifyProvider,
  updateLiscence,
  getPendingProviderUpdates,
  approveProviderUpdate,
  rejectProviderUpdate,
};

module.exports = { ProviderController };