const { default: status } = require("http-status");
const Provider = require("./Provider");
const Auth = require("../auth/Auth");
const User = require("../user/User");
const Category = require("../category/Category");
const ServiceRequest = require("../serviceRequest/ServiceRequest");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const unlinkFile = require("../../../util/unlinkFile");

// Helper function to calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

const deg2rad = (deg) => deg * (Math.PI/180);

// Register Provider
const registerProvider = async (req) => {
  const { files, body: data, user } = req;

  validateFields(data, [
    "companyName",
    "serviceCategory",
    "subcategory",
    "serviceLocation",
    "contactPerson",
    "coveredRadius",
    "latitude",
    "longitude"
  ]);

  // Check if provider already exists
  const existingProvider = await Provider.findOne({ authId: user.authId });
  if (existingProvider) {
    throw new ApiError(status.BAD_REQUEST, "Provider already registered");
  }

  // Validate category and subcategory
  const category = await Category.findOne({
    _id: data.serviceCategory,
    isActive: true
  });
  if (!category) {
    throw new ApiError(status.BAD_REQUEST, "Invalid or inactive category");
  }

  const subcategoryExists = category.subcategories.some(
    sub => sub._id.toString() === data.subcategory && sub.isActive
  );
  if (!subcategoryExists) {
    throw new ApiError(status.BAD_REQUEST, "Invalid or inactive subcategory");
  }

  const selectedSubcategory = category.subcategories.find(
    sub => sub._id.toString() === data.subcategory
  );

  const providerData = {
    authId: user.authId,
    companyName: data.companyName,
    website: data.website,
    serviceCategory: data.serviceCategory,
    subcategory: selectedSubcategory.name,
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    coveredRadius: parseFloat(data.coveredRadius),
    serviceLocation: data.serviceLocation,
    contactPerson: JSON.parse(data.contactPerson),
    workingHours: JSON.parse(data.workingHours || "[]"),
  };

  // Handle file uploads
  if (files && files.licenses) {
    providerData.licenses = files.licenses.map(file => file.path);
  }

  if (files && files.certificates) {
    providerData.certificates = files.certificates.map(file => file.path);
  }

  const provider = await Provider.create(providerData);
  return provider;
};

// Get Provider Profile
const getProviderProfile = async (userData) => {
  const provider = await Provider.findOne({ authId: userData.authId })
    .populate("serviceCategory", "name icon")
    .lean();

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

// Update Provider Profile (requires admin approval)
const updateProviderProfile = async (req) => {
  const { files, body: data, user } = req;
  
  const existingProvider = await Provider.findOne({ authId: user.authId });
  if (!existingProvider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  // Store updates in pendingUpdates for admin approval
  const updateData = {};

  if (data.companyName) updateData.companyName = data.companyName;
  if (data.website) updateData.website = data.website;
  if (data.serviceLocation) updateData.serviceLocation = data.serviceLocation;
  if (data.coveredRadius) updateData.coveredRadius = parseFloat(data.coveredRadius);
  if (data.contactPerson) updateData.contactPerson = JSON.parse(data.contactPerson);
  
  if (data.latitude && data.longitude) {
    updateData.latitude = parseFloat(data.latitude);
    updateData.longitude = parseFloat(data.longitude);
  }

  if (data.workingHours) {
    updateData.workingHours = JSON.parse(data.workingHours);
  }

  // Handle file uploads
  if (files && files.licenses) {
    updateData.licenses = files.licenses.map(file => file.path);
  }

  if (files && files.certificates) {
    updateData.certificates = files.certificates.map(file => file.path);
  }

  // Store updates in pendingUpdates field for admin approval
  existingProvider.pendingUpdates = updateData;
  await existingProvider.save();

  return { message: "Update request submitted for admin approval" };
};

// Toggle Provider Active Status
const toggleProviderStatus = async (userData, payload) => {
  validateFields(payload, ["isActive"]);

  const provider = await Provider.findOne({ authId: userData.authId });
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  provider.isActive = payload.isActive;
  await provider.save();

  return provider;
};

// Get Potential Requests for Provider
const getPotentialRequests = async (userData, query) => {
  const provider = await Provider.findOne({ authId: userData.authId });
  if (!provider || !provider.isActive) {
    throw new ApiError(status.NOT_FOUND, "Provider not found or inactive");
  }

  // Find requests that match provider's category and location
  const requests = await ServiceRequest.find({
    serviceCategory: provider.serviceCategory,
    subcategory: provider.subcategory,
    status: "PENDING",
    "potentialProviders.providerId": { $ne: provider._id },
  })
    .populate("customerId", "name")
    .populate("serviceCategory", "name icon")
    .select("requestId customerId serviceCategory subcategory priority createdAt")
    .lean();

  // Filter by distance
  const nearbyRequests = requests.filter(request => {
    const distance = calculateDistance(
      provider.latitude,
      provider.longitude,
      request.latitude,
      request.longitude
    );
    return distance <= provider.coveredRadius && distance <= 50;
  });

  return {
    meta: {
      page: 1,
      limit: nearbyRequests.length,
      total: nearbyRequests.length,
      totalPages: 1,
    },
    requests: nearbyRequests,
  };
};

// Handle Request Response (Accept/Decline)
const handleRequestResponse = async (userData, payload) => {
  validateFields(payload, ["requestId", "action"]);

  const provider = await Provider.findOne({ authId: userData.authId });
  const serviceRequest = await ServiceRequest.findById(payload.requestId);

  if (!provider || !serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Provider or request not found");
  }

  const potentialProviderIndex = serviceRequest.potentialProviders.findIndex(
    pp => pp.providerId.toString() === provider._id.toString()
  );

  if (potentialProviderIndex === -1) {
    throw new ApiError(status.BAD_REQUEST, "Request not available for this provider");
  }

  if (payload.action === "ACCEPT") {
    serviceRequest.potentialProviders[potentialProviderIndex].status = "ACCEPTED";
    serviceRequest.potentialProviders[potentialProviderIndex].acceptedAt = new Date();
    serviceRequest.status = "PROCESSING";
  } else if (payload.action === "DECLINE") {
    serviceRequest.potentialProviders[potentialProviderIndex].status = "DECLINED";
    serviceRequest.potentialProviders[potentialProviderIndex].declinedAt = new Date();
  }

  await serviceRequest.save();
  return { message: `Request ${payload.action.toLowerCase()}ed successfully` };
};

// Mark Request as Complete
const markRequestComplete = async (req) => {
  const { files, body: data, user } = req;
  validateFields(data, ["requestId"]);

  const provider = await Provider.findOne({ authId: user.authId });
  const serviceRequest = await ServiceRequest.findOne({
    _id: data.requestId,
    assignedProvider: provider._id,
    status: "IN_PROGRESS",
  });

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Request not found or not assigned to you");
  }

  // Handle completion proof uploads
  if (files && files.completionProof) {
    serviceRequest.completionProof = files.completionProof.map(file => file.path);
  }

  serviceRequest.status = "COMPLETED";
  await serviceRequest.save();

  return { message: "Request marked as completed successfully" };
};

// Get All Providers (Admin)
const getAllProviders = async (query) => {
  const providerQuery = new QueryBuilder(
    Provider.find({})
      .populate("serviceCategory", "name icon")
      .populate("authId", "name email")
      .lean(),
    query
  )
    .search(["companyName", "serviceLocation"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [providers, meta] = await Promise.all([
    providerQuery.modelQuery,
    providerQuery.countTotal(),
  ]);

  return { meta, providers };
};

module.exports = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  toggleProviderStatus,
  getPotentialRequests,
  handleRequestResponse,
  markRequestComplete,
  getAllProviders,
};