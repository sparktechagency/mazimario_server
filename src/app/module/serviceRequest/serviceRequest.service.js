const { default: status } = require("http-status");
const ServiceRequest = require("./ServiceRequest");
const Auth = require("../auth/Auth");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");

const createServiceRequest = async (req) => {
  const { files, body: data, user } = req;

  validateFields(data, [
    "serviceCategory",
    "subcategory",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "address",
    "latitude",
    "longitude",
    "customerPhone",
  ]);

  // Check if phone is verified
  const auth = await Auth.findById(user.authId);
  if (!auth.isPhoneVerified) {
    throw new ApiError(
      status.FORBIDDEN,
      "Phone number must be verified to create service request"
    );
  }

  const serviceRequestData = {
    customerId: user.userId,
    customerPhone: data.customerPhone,
    serviceCategory: data.serviceCategory,
    subcategory: data.subcategory,
    priority: data.priority || "Medium",
    startDate: data.startDate,
    endDate: data.endDate,
    startTime: data.startTime,
    endTime: data.endTime,
    address: data.address,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
  };

  // Handle file uploads
  if (files && files.attachments) {
    serviceRequestData.attachments = files.attachments.map((file) => file.path);
  }

  const serviceRequest = await ServiceRequest.create(serviceRequestData);

  return serviceRequest;
};

const getServiceRequests = async (userData, query) => {
  const { userId, role } = userData;

  let filter = {};
  if (role === "user") {
    filter.customerId = userId;
  } else if (role === "provider") {
    filter.assignedProvider = userId;
  }

  const serviceRequestQuery = new QueryBuilder(
    ServiceRequest.find(filter)
      .populate("serviceCategory")
      .populate("subcategory")
      .populate("assignedProvider")
      .populate("customerId")
      .lean(),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const [requests, meta] = await Promise.all([
    serviceRequestQuery.modelQuery,
    serviceRequestQuery.countTotal(),
  ]);

  return {
    meta,
    requests,
  };
};

const getServiceRequestById = async (query) => {
  validateFields(query, ["requestId"]);

  const serviceRequest = await ServiceRequest.findById(query.requestId)
    .populate("serviceCategory")
    .populate("subcategory")
    .populate("assignedProvider")
    .populate("customerId")
    .lean();

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const updateServiceRequestStatus = async (userData, payload) => {
  validateFields(payload, ["requestId", "status"]);

  const serviceRequest = await ServiceRequest.findByIdAndUpdate(
    payload.requestId,
    { status: payload.status },
    { new: true, runValidators: true }
  )
    .populate("serviceCategory")
    .populate("subcategory");

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const assignProviderToRequest = async (userData, payload) => {
  validateFields(payload, ["requestId", "providerId"]);

  const serviceRequest = await ServiceRequest.findByIdAndUpdate(
    payload.requestId,
    { assignedProvider: payload.providerId, status: "Processing" },
    { new: true, runValidators: true }
  )
    .populate("serviceCategory")
    .populate("subcategory")
    .populate("assignedProvider")
    .populate("customerId");

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const ServiceRequestService = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  updateServiceRequestStatus,
  assignProviderToRequest,
};

module.exports = { ServiceRequestService };
