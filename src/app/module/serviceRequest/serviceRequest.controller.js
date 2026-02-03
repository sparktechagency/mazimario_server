const { ServiceRequestService } = require("./serviceRequest.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const createServiceRequest = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.createServiceRequest(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Service request created successfully",
    data: result,
  });
});

const getServiceRequests = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.getServiceRequests(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service requests retrieved successfully",
    data: result,
  });
});

const getServiceRequestById = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.getServiceRequestById(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service request retrieved successfully",
    data: result,
  });
});

const getServiceRequestByIdDetails = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.getServiceRequestByIdDetails(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service request details retrieved successfully",
    data: result,
  });
});

const updateServiceRequestStatus = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.updateServiceRequestStatus(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service request status updated successfully",
    data: result,
  });
});

const assignProviderToRequest = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.assignProviderToRequest(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider assigned to service request successfully",
    data: result,
  });
});

const getAllProvider = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.getAllProviderService(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service requests retrieved successfully",
    data: result,
  });
});

const getAllServiceRequests = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.getAllServiceRequests(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Filtered all provider successfully",
    data: result,
  });
});

const completeServiceRequest = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.completeServiceRequest(req.user, req.body, req.files);
  console.log(req.user, "hello");
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Service request completed successfully",
    data: result,
  });
});

// ==================== OFFER SYSTEM CONTROLLERS ====================
const submitOffer = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.submitOffer(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offer submitted successfully",
    data: result,
  });
});

const viewOffers = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.viewOffers(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offers retrieved successfully",
    data: result,
  });
});

const acceptOffer = catchAsync(async (req, res) => {
  const result = await ServiceRequestService.acceptOffer(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Offer accepted successfully. Provider has been assigned.",
    data: result,
  });
});

const ServiceRequestController = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  getServiceRequestByIdDetails,
  updateServiceRequestStatus,
  assignProviderToRequest,
  getAllProvider,
  getAllServiceRequests,
  completeServiceRequest,
  // New offer system controllers
  submitOffer,
  viewOffers,
  acceptOffer
};

module.exports = { ServiceRequestController };