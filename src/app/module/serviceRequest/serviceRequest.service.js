const { default: status } = require("http-status");
const ServiceRequest = require("./ServiceRequest");
const Category = require("../category/Category");
const Auth = require("../auth/Auth");
const Provider = require("../provider/Provider");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");
const mongoose = require("mongoose");
const postNotification = require("../../../util/postNotification");

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

// Find matching providers - UPDATED FOR CATEGORY-ONLY MATCHING
// CORRECT - Using new field names:
const findMatchingProviders = async (serviceRequestData) => {
  const { serviceCategory, latitude, longitude } = serviceRequestData;

  // Find providers who have this serviceCategory in their serviceCategories array
  const matchingProviders = await Provider.find({
    serviceCategories: serviceCategory, // ✅ CORRECT: Check array inclusion
    // ❌ REMOVED: subcategory (providers don't have subcategories)
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


// const createServiceRequest = async (req) => {
//   const { files, body: data, user } = req;

//   validateFields(data, [
//     "serviceCategory",
//     "subcategory",
//     "startDate",
//     "endDate",
//     "startTime",
//     "endTime",
//     "address",
//     "latitude",
//     "longitude",
//     "customerPhone",
//   ]);

//   const auth = await Auth.findById(user.authId);
//   // if (!auth.isPhoneVerified) {
//   //   throw new ApiError(status.FORBIDDEN, "Phone number must be verified");
//   // }

//   const category = await Category.findOne({
//     _id: data.serviceCategory,
//     isActive: true,
//   });
//   if (!category) {
//     throw new ApiError(status.BAD_REQUEST, "Invalid category");
//   }

//   const subcategoryExists = category.subcategories.some(
//     (sub) => sub._id.toString() === data.subcategory && sub.isActive
//   );
//   if (!subcategoryExists) {
//     throw new ApiError(status.BAD_REQUEST, "Invalid subcategory");
//   }

//   const selectedSubcategory = category.subcategories.find(
//     (sub) => sub._id.toString() === data.subcategory
//   );

//   const serviceRequestData = {
//     customerId: user.userId,
//     customerPhone: data.customerPhone,
//     serviceCategory: data.serviceCategory,
//     subcategory: selectedSubcategory.name,
//     priority: data.priority || "Normal",
//     startDate: data.startDate,
//     endDate: data.endDate,
//     startTime: data.startTime,
//     endTime: data.endTime,
//     address: data.address,
//     description: data.description,
//     latitude: parseFloat(data.latitude),
//     longitude: parseFloat(data.longitude),
//   };

//   if (files && files.attachments) {
//     serviceRequestData.attachments = files.attachments.map((file) => file.path);
//   }

//   const serviceRequest = await ServiceRequest.create(serviceRequestData);

//   // Send notification to user
//   await postNotification(
//     "Service Request Created",
//     `Your service request for ${selectedSubcategory.name} has been created successfully. Request ID: ${serviceRequest._id}`,
//     user.userId
//   );

//   // Send notification to admin
//   await postNotification(
//     "New Service Request Created",
//     `New service request for ${selectedSubcategory.name} has been created by ${user.name || 'a customer'}. Request ID: ${serviceRequest._id}`
//   );

//   // Find and assign matching providers
//   const matchingProviderIds = await findMatchingProviders(serviceRequestData);
//   serviceRequest.potentialProviders = matchingProviderIds.map((providerId) => ({
//     providerId,
//     status: "PENDING",
//   }));

//   await serviceRequest.save();

//   return await serviceRequest.populate("serviceCategory", "name icon");
// };

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

  // Send notification to user
  await postNotification(
    "Service Request Created",
    `Your service request for ${selectedSubcategory.name} has been created successfully. Request ID: ${serviceRequest.requestId}`,
    user.userId
  );

  // Send notification to admin
  await postNotification(
    "New Service Request Created",
    `New service request for ${selectedSubcategory.name} has been created by ${user.name || 'a customer'}. Request ID: ${serviceRequest.requestId}`
  );

  // STEP 1: Find matching providers
  const matchingProviders = await findMatchingProviders(serviceRequestData);
  
  if (matchingProviders.length > 0) {
    // STEP 2: Add to ServiceRequest's potentialProviders (existing logic)
    serviceRequest.potentialProviders = matchingProviders.map((providerId) => ({
      providerId,
      status: "PENDING",
    }));

    // STEP 3: ALSO ADD TO EACH PROVIDER'S incomingRequests ARRAY
    for (const providerId of matchingProviders) {
      await Provider.findByIdAndUpdate(
        providerId,
        {
          $push: {
            incomingRequests: {
              requestId: serviceRequest._id,
              status: "PENDING",
              receivedAt: new Date()
            }
          }
        }
      );

      // Send notification to provider
      await postNotification(
        "New Service Request Available",
        `A new ${selectedSubcategory.name} service request is available in your area. Request ID: ${serviceRequest.requestId}`,
        providerId
      );
    }

    await serviceRequest.save();
  }

  return await serviceRequest.populate("serviceCategory", "name icon");
};

const getServiceRequests = async (userData, query) => {
  const { userId, role } = userData;

  // Base filter - always filter by the logged-in user's ID
  const filter = { customerId: new mongoose.Types.ObjectId(userId) };

  // Status filter (optional)
  if (query.status) {
    filter.status = query.status;
  }

  const serviceRequestQuery = new QueryBuilder(
    ServiceRequest.find(filter)
      .populate("serviceCategory", "name icon")
      .populate("assignedProvider", "companyName contactPerson")
      .populate("customerId", "name email phoneNumber")
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
    success: true,
    message: "Your service requests retrieved successfully"
  };
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

const getAllServiceRequests = async (query) => {
  const serviceRequestQuery = new QueryBuilder(
    ServiceRequest.find(query)
      .populate("serviceCategory", "name icon")
      .populate("assignedProvider", "companyName contactPerson phoneNumber")
      .populate("customerId", "name email phoneNumber address")
      .lean(),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const [serviceRequests, meta] = await Promise.all([
    serviceRequestQuery.modelQuery,
    serviceRequestQuery.countTotal(),
  ]);

  return { meta, serviceRequests };
};


//NEW API FOR MENUAL MATCHING PROVIDER FROM DASHBOARD



const ServiceRequestService = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  getServiceRequestByIdDetails,
  updateServiceRequestStatus,
  assignProviderToRequest,
  getAllServiceRequests,
};

module.exports = { ServiceRequestService };
