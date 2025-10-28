const { default: status } = require("http-status");
const ServiceRequest = require("./ServiceRequest");
const Category = require("../category/Category");
const Auth = require("../auth/Auth");
const Provider = require("../provider/Provider");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");

// Helper function to calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg) => deg * (Math.PI / 180);

// Find matching providers
const findMatchingProviders = async (serviceRequestData) => {
  const { serviceCategory, subcategory, latitude, longitude } =
    serviceRequestData;

  const matchingProviders = await Provider.find({
    serviceCategory,
    subcategory,
    isActive: true,
    isVerified: true,
  }).select("_id coveredRadius latitude longitude workingHours");

  const eligibleProviders = [];
  const userLat = parseFloat(latitude);
  const userLon = parseFloat(longitude);

  for (const provider of matchingProviders) {
    // Check distance
    const distance = calculateDistance(
      userLat,
      userLon,
      provider.latitude,
      provider.longitude
    );

    if (distance <= 50 && distance <= provider.coveredRadius) {
      // Check availability (simplified - you might want to check specific date/time)
      const hasAvailability = provider.workingHours.some(
        (wh) => wh.isAvailable
      );
      if (hasAvailability) {
        eligibleProviders.push(provider._id);
      }
    }
  }

  return eligibleProviders;
};

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

  const auth = await Auth.findById(user.authId);
  if (!auth.isPhoneVerified) {
    throw new ApiError(status.FORBIDDEN, "Phone number must be verified");
  }

  const category = await Category.findOne({
    _id: data.serviceCategory,
    isActive: true,
  });
  if (!category) {
    throw new ApiError(status.BAD_REQUEST, "Invalid category");
  }

  const subcategoryExists = category.subcategories.some(
    (sub) => sub._id.toString() === data.subcategory && sub.isActive
  );
  if (!subcategoryExists) {
    throw new ApiError(status.BAD_REQUEST, "Invalid subcategory");
  }

  const selectedSubcategory = category.subcategories.find(
    (sub) => sub._id.toString() === data.subcategory
  );

  const serviceRequestData = {
    customerId: user.userId,
    customerPhone: data.customerPhone,
    serviceCategory: data.serviceCategory,
    subcategory: selectedSubcategory.name,
    priority: data.priority || "Normal",
    startDate: data.startDate,
    endDate: data.endDate,
    startTime: data.startTime,
    endTime: data.endTime,
    address: data.address,
    description: data.description,
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
  };

  if (files && files.attachments) {
    serviceRequestData.attachments = files.attachments.map((file) => file.path);
  }

  const serviceRequest = await ServiceRequest.create(serviceRequestData);

  // Find and assign matching providers
  const matchingProviderIds = await findMatchingProviders(serviceRequestData);
  serviceRequest.potentialProviders = matchingProviderIds.map((providerId) => ({
    providerId,
    status: "PENDING",
  }));

  await serviceRequest.save();

  return await serviceRequest.populate("serviceCategory", "name icon");
};

const getServiceRequests = async (userData, query) => {
  const { userId, role } = userData;

  let filter = {};
  if (role === "user") {
    filter.customerId = userId;
  } else if (role === "provider") {
    filter.assignedProvider = userId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  const serviceRequestQuery = new QueryBuilder(
    ServiceRequest.find(filter)
      .populate("serviceCategory", "name icon")
      .populate("assignedProvider", "companyName contactPerson")
      .populate("customerId", "name email phoneNumber")
      .populate("potentialProviders.providerId", "companyName contactPerson")
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

  return { meta, requests };
};

const getServiceRequestById = async (query) => {
  validateFields(query, ["requestId"]);

  const serviceRequest = await ServiceRequest.findById(query.requestId)
    .populate("serviceCategory", "name icon")
    .populate("assignedProvider", "companyName contactPerson phoneNumber")
    .populate("customerId", "name email phoneNumber address")
    .populate("potentialProviders.providerId", "companyName contactPerson")
    .lean();

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const getServiceRequestByIdDetails = async (userData, query) => {
  validateFields(query, ["requestId"]);

  const { userId, role } = userData;
  let filter = { _id: query.requestId };

  if (role === "user") {
    filter.customerId = userId;
  } else if (role === "provider") {
    filter.assignedProvider = userId;
  }

  const serviceRequest = await ServiceRequest.findOne(filter)
    .populate("serviceCategory", "name icon")
    .populate("assignedProvider", "companyName contactPerson phoneNumber")
    .populate("customerId", "name email phoneNumber address")
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
  ).populate("serviceCategory", "name icon");

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const assignProviderToRequest = async (userData, payload) => {
  validateFields(payload, ["requestId", "providerId"]);

  const serviceRequest = await ServiceRequest.findByIdAndUpdate(
    payload.requestId,
    {
      assignedProvider: payload.providerId,
      status: "ASSIGNED",
    },
    { new: true, runValidators: true }
  )
    .populate("serviceCategory", "name icon")
    .populate("assignedProvider", "companyName contactPerson phoneNumber")
    .populate("customerId", "name email phoneNumber");

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  return serviceRequest;
};

const ServiceRequestService = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  getServiceRequestByIdDetails,
  updateServiceRequestStatus,
  assignProviderToRequest,
};

module.exports = { ServiceRequestService };
