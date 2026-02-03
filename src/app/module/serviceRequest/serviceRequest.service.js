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
const { calculateLeadPrice } = require("../lead/lead.service");

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
    serviceRequestData.attachments = files.attachments.map((file) => file.location);
  }

  // Calculate lead price
  const pricing = await calculateLeadPrice(serviceRequestData);
  serviceRequestData.leadPrice = pricing.amount;
  serviceRequestData.currency = pricing.currency;

  const serviceRequest = await ServiceRequest.create(serviceRequestData);

  //send notification
  await Promise.all([

    // Send notification to user
    postNotification(
      "Service Request Created",
      `Your service request for ${selectedSubcategory.name} has been created successfully. Request ID: ${serviceRequest.requestId}`,
      user.userId
    ),

    // Send notification to admin
    postNotification(
      "New Service Request Created",
      `New service request for ${selectedSubcategory.name} has been created by ${user.name || 'a customer'}. Request ID: ${serviceRequest.requestId}`
    )
  ]);

  // STEP 1: Find matching providers
  const matchingProviders = await findMatchingProviders(serviceRequestData);

  if (matchingProviders.length > 0) {
    // STEP 2: Add to ServiceRequest's potentialProviders (existing logic)
    serviceRequest.potentialProviders = matchingProviders.map((providerId) => ({
      providerId,
      status: "PENDING",
    }));

    // STEP 3: Send notifications to providers
    for (const providerId of matchingProviders) {
      // Send notification to provider
      await postNotification(
        "New Service Request Available",
        `A new ${selectedSubcategory.name} service request is available in your area. Request ID: ${serviceRequest.requestId}`,
        providerId
      );

      console.log("Notification sent to provider", providerId);
    }

    await serviceRequest.save();
  }

  return await serviceRequest.populate("serviceCategory", "name icon");
};

const getServiceRequests = async (userData, query) => {
  const { userId, role } = userData;

  // Base filter - always filter by the logged-in user's ID
  const filter = { customerId: new mongoose.Types.ObjectId(userId) };

  // Enhanced Status filter with multi-provider logic
  if (query.status) {
    const userStatus = query.status.toUpperCase();

    switch (userStatus) {
      case 'PENDING':
        // Request is still pending - no provider accepted yet
        // Include requests with status PENDING that are NOT fully declined
        filter.status = 'PENDING';
        filter.$or = [
          // No providers assigned yet
          { potentialProviders: { $size: 0 } },
          // Or at least one provider is still pending (not all declined)
          { 'potentialProviders.status': { $in: ['PENDING', 'AWAITING_PAYMENT'] } }
        ];
        break;

      case 'ONGOING':
        // A provider accepted and is working on it
        filter.status = { $in: ['ASSIGNED', 'PROCESSING'] };
        break;

      case 'COMPLETED':
        // Service completed
        filter.status = 'COMPLETED';
        break;

      case 'DECLINED':
        // ALL providers declined this request
        filter.status = 'PENDING';
        // Must have at least one provider
        filter['potentialProviders.0'] = { $exists: true };
        // All providers must have declined
        filter.$expr = {
          $eq: [
            { $size: '$potentialProviders' },
            {
              $size: {
                $filter: {
                  input: '$potentialProviders',
                  cond: { $eq: ['$$this.status', 'DECLINED'] }
                }
              }
            }
          ]
        };
        break;

      default:
        // If unknown status, use it as-is (backward compatibility)
        filter.status = query.status;
    }
  }

  const serviceRequestQuery = new QueryBuilder(
    ServiceRequest.find(filter)
      .populate("serviceCategory", "name icon")
      .populate("assignedProvider", "companyName contactPerson")
      .populate("customerId", "name email phoneNumber")
      .populate({
        path: "completedBy",
        populate: {
          path: "authId",
          select: "name, email"
        }
      })
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

const getServiceRequestById = async (userData, query) => {
  validateFields(query, ["requestId"]);
  const { userId, role } = userData || {};

  const serviceRequest = await ServiceRequest.findById(query.requestId)
    .populate("serviceCategory", "name icon")
    .populate("assignedProvider", "companyName contactPerson phoneNumber")
    .populate("customerId", "name email phoneNumber address")
    .populate("potentialProviders.providerId", "companyName contactPerson")
    .lean();

  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  // Masking Logic for Providers
  if (role === 'provider') {
    const provider = await Provider.findOne({ authId: userId });

    // Check if purchased
    const isPurchased = serviceRequest.purchasedBy?.some(p =>
      p.provider.toString() === provider?._id.toString()
    );

    console.log(serviceRequest.customerPhone);

    if (!isPurchased) {
      // Mask sensitive data

      if (serviceRequest.customerId) {
        serviceRequest.customerId.name = "Customer (Locked)";
        serviceRequest.customerId.email = "Purchase to view";
        serviceRequest.customerId.phoneNumber = "Purchase to view";
        serviceRequest.customerId.address = "Purchase to view";

      }
      serviceRequest.address = "Area Protected (Purchase to view)";
      serviceRequest.customerPhone = "Purchase to view";
      // Keep latitude/longitude for distance calculation but maybe fuzz them if needed? 
      // For now keeping them as they are needed for map preview mostly. 
      // But exact address is masked.
    }
  }

  //find matching providers
  const eligibleProviders = await findMatchingProviders({ serviceCategory: serviceRequest?.serviceCategory?._id, latitude: serviceRequest?.latitude, longitude: serviceRequest?.longitude });

  // return eligibleProviders;
  // console.log(eligibleProviders);
  //get details of all relevant providers
  const providerIds = eligibleProviders.map(id => new mongoose.Types.ObjectId(id));

  const providersWithUserData = await Provider.aggregate([
    {
      $match: {
        _id: { $in: providerIds },
      },
    },
    {
      $lookup: {
        from: "auths", // name of the User collection in MongoDB
        localField: "authId", // field in Provider collection
        foreignField: "_id", // matching field in User collection
        as: "providerDetails",
      },
    },
    {
      $unwind: {
        path: "$providerDetails",
        preserveNullAndEmptyArrays: true, // keep provider even if no user found
      },
    },
    {
      $project: {
        _id: 1,
        authId: 1,
        serviceLocation: 1,
        companyName: 1,
        image: null,
        "providerDetails.name": 1,
        "providerDetails.email": 1,
        // "providerDetails.profile_image": 1,
        // "providerDetails.address": 1,
      },
    },
  ]);

  return { serviceRequest, providers: providersWithUserData };
};

const getServiceRequestByIdDetails = async (userData, query) => {
  validateFields(query, ["requestId"]);

  const { userId, role } = userData;
  let filter = { _id: query.requestId };

  if (role === "user") {
    filter.customerId = userId;
  } else if (role === "provider") {
    // Find provider by Auth ID first
    const provider = await Provider.findOne({ authId: userId });
    if (!provider) throw new ApiError(status.NOT_FOUND, "Provider profile not found");

    // Allow if assigned OR purchased
    filter.$or = [
      { assignedProvider: provider._id },
      { 'purchasedBy.provider': provider._id }
    ];
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
  const { userId, role, authId } = userData;

  const serviceRequest = await ServiceRequest.findOne({ _id: payload.requestId });
  if (!serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  // AUTHORIZATION CHECK
  if (role === "ADMIN") {
    // Admin can do anything
  } else if (role === "PROVIDER") {
    // Check if provider exists
    const provider = await Provider.findOne({ authId: authId });
    if (!provider) throw new ApiError(status.NOT_FOUND, "Provider not found");

    // Provider MUST be the assigned provider
    if (!serviceRequest.assignedProvider || serviceRequest.assignedProvider.toString() !== provider._id.toString()) {
      throw new ApiError(status.FORBIDDEN, "You are not the assigned provider for this request");
    }
  } else if (role === "USER") {
    // Customer MUST be the owner
    if (serviceRequest.customerId.toString() !== userId) {
      throw new ApiError(status.FORBIDDEN, "You are not authorized to update this request");
    }
  }

  // Update status logic
  if (payload.status === "APPROVED") {
    if (!serviceRequest.completedBy) {
      throw new ApiError(status.BAD_REQUEST, "Cannot approve a request that hasn't been completed by a provider.");
    }
    // Finalize assignment
    serviceRequest.assignedProvider = serviceRequest.completedBy;
    serviceRequest.status = "APPROVED";
  } else {
    serviceRequest.status = payload.status;
  }

  await serviceRequest.save();

  // Send notifications based on new status
  if (payload.status === "IN_PROGRESS") {
    await postNotification(
      "Work Started",
      `Provider has started working on your request ${serviceRequest.requestId}.`,
      serviceRequest.customerId
    );
  } else if (payload.status === "APPROVED") {
    await postNotification(
      "Work Approved",
      `Customer approved the completion of request ${serviceRequest.requestId}. Great job!`,
      serviceRequest.assignedProvider
    );
  }

  return await serviceRequest.populate("serviceCategory", "name icon");
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
    ServiceRequest.find()
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

const getAllProviderService = async (query) => {
  const { serviceCategory, latitude, longitude } = query;

  validateFields(query, ["serviceCategory", "latitude", "longitude"]);

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

  // return eligibleProviders;
  console.log(eligibleProviders);
  //get details of all relevant providers
  const providerIds = eligibleProviders.map(id => new mongoose.Types.ObjectId(id));

  const providersWithUserData = await Provider.aggregate([
    {
      $match: {
        _id: { $in: providerIds },
      },
    },
    {
      $lookup: {
        from: "users", // name of the User collection in MongoDB
        localField: "authId", // field in Provider collection
        foreignField: "authId", // matching field in User collection
        as: "userDetails",
      },
    },
    {
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true, // keep provider even if no user found
      },
    },
    {
      $project: {
        _id: 1,
        authId: 1,
        "userDetails.name": 1,
        "userDetails.email": 1,
        "userDetails.profile_image": 1,
        "userDetails.address": 1,
      },
    },
  ]);
  console.log(providersWithUserData);

  return providersWithUserData;
}


//NEW API FOR MENUAL MATCHING PROVIDER FROM DASHBOARD



const completeServiceRequest = async (userData, payload, files) => {
  validateFields(payload, ["requestId"]);
  const { userId, role, authId } = userData;
  // console.log(userData, "hello s");

  // Find provider based on auth user
  if (role !== 'PROVIDER') {
    throw new ApiError(status.FORBIDDEN, "Only providers can complete service requests");
  }

  const provider = await Provider.findOne({ authId: authId });
  // console.log(provider);
  if (!provider) throw new ApiError(status.NOT_FOUND, "Provider not found");

  const serviceRequest = await ServiceRequest.findById(payload.requestId);
  if (!serviceRequest) throw new ApiError(status.NOT_FOUND, "Service request not found");

  // Verify provider is assigned or purchased
  const isAssigned = serviceRequest.assignedProvider?.toString() === provider._id.toString();
  const isPurchased = serviceRequest.purchasedBy?.some(p => p.provider.toString() === provider._id.toString());

  if (!isAssigned && !isPurchased) {
    throw new ApiError(status.FORBIDDEN, "You are not authorized to complete this request");
  }

  // Verify status
  const validStatuses = ["ASSIGNED", "IN_PROGRESS", "PURCHASED"];
  if (!validStatuses.includes(serviceRequest.status)) {
    throw new ApiError(status.BAD_REQUEST, `Cannot complete request from status: ${serviceRequest.status}`);
  }

  // Handle Proof Files
  let proofs = [];
  if (files && files.completionProof) {
    proofs = files.completionProof.map(file => ({
      url: file.location, // S3 location
      type: file.mimetype.startsWith('image/') ? 'image' : 'video',
      uploadedAt: new Date(),
      size: file.size,
      mimeType: file.mimetype
    }));
  } else {
    throw new ApiError(status.BAD_REQUEST, "Completion proof (image/video) is required");
  }

  // Populate provider details


  // Update Service Request
  serviceRequest.status = "COMPLETED";
  serviceRequest.completedAt = new Date();
  serviceRequest.completedBy = provider._id;
  serviceRequest.completionProof = proofs;
  serviceRequest.providerNotes = payload.notes;

  // Update this specific provider's status in potentialProviders to COMPLETED
  // This allows filtering by providerStatus=COMPLETED
  const providerIndex = serviceRequest.potentialProviders.findIndex(
    p => p.providerId.toString() === provider._id.toString()
  );

  if (providerIndex !== -1) {
    serviceRequest.potentialProviders[providerIndex].status = "COMPLETED";
    serviceRequest.potentialProviders[providerIndex].completedAt = new Date();
  }

  await serviceRequest.save();

  await serviceRequest.populate({
    path: "completedBy",
    populate: {
      path: "authId",
      select: "-password -__v" // Exclude sensitive fields
    }
  });

  // Notify Customer
  await postNotification(
    "Service Completed",
    `Provider has marked your service request ${serviceRequest.requestId} as COMPLETED. Please review the proof and approve.`,
    serviceRequest.customerId
  );

  return {
    status: serviceRequest.status,
    message: "Service request completed successfully",
    completedBy: serviceRequest.completedBy
  };
};



// ==================== OFFER SYSTEM ====================
// Provider submits offer/proposal
const submitOffer = async (userData, payload) => {
  validateFields(payload, ["requestId", "proposedPrice", "estimatedDuration"]);

  // Find provider
  const provider = await Provider.findOne({ authId: userData.authId }).sort({ createdAt: -1 });
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  // Find request
  const request = await ServiceRequest.findOne({ requestId: payload.requestId });
  if (!request) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  // Check if provider purchased the lead
  const hasPurchased = request.purchasedBy?.some(
    p => p.provider.toString() === provider._id.toString()
  );

  if (!hasPurchased) {
    throw new ApiError(status.FORBIDDEN, "You must purchase this lead before submitting an offer");
  }

  // Check if already submitted offer
  const existingOffer = request.offers?.find(
    o => o.provider.toString() === provider._id.toString()
  );

  if (existingOffer) {
    throw new ApiError(status.CONFLICT, "You already submitted an offer for this request");
  }

  // Add offer
  request.offers = request.offers || [];
  request.offers.push({
    provider: provider._id,
    proposedPrice: parseFloat(payload.proposedPrice),
    currency: payload.currency || "USD",
    estimatedDuration: payload.estimatedDuration,
    message: payload.message || "",
    status: "PENDING"
  });

  await request.save();

  // Notify customer
  await postNotification(
    "New Offer Received",
    `${provider.companyName} submitted an offer of $${payload.proposedPrice} for request ${request.requestId}`,
    request.customerId
  );

  return await request.populate([
    { path: "offers.provider", select: "companyName rating totalReviews profile_image" },
    { path: "serviceCategory", select: "name icon" }
  ]);
};

// Customer views all offers
const viewOffers = async (userData, query) => {
  validateFields(query, ["requestId"]);

  const request = await ServiceRequest.findOne({ requestId: query.requestId })
    .populate("offers.provider", "companyName rating totalReviews profile_image contactPerson")
    .populate("serviceCategory", "name icon")
    .lean();

  if (!request) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  // Verify customer owns this request
  if (request.customerId.toString() !== userData.userId) {
    throw new ApiError(status.FORBIDDEN, "Not your request");
  }

  return {
    requestId: request.requestId,
    serviceCategory: request.serviceCategory,
    status: request.status,
    offers: request.offers || [],
    totalOffers: request.offers?.length || 0,
    assignedProvider: request.assignedProvider
  };
};

// Customer accepts a provider's offer
const acceptOffer = async (userData, payload) => {
  validateFields(payload, ["requestId", "providerId"]);

  const request = await ServiceRequest.findOne({ requestId: payload.requestId });
  if (!request) {
    throw new ApiError(status.NOT_FOUND, "Service request not found");
  }

  // Verify customer owns this request
  if (request.customerId.toString() !== userData.userId) {
    throw new ApiError(status.FORBIDDEN, "Not your request");
  }

  // Find the offer
  const offerIndex = request.offers?.findIndex(
    o => o.provider.toString() === payload.providerId && o.status === "PENDING"
  );

  if (offerIndex === -1) {
    throw new ApiError(status.NOT_FOUND, "Offer not found or already processed");
  }

  const acceptedOffer = request.offers[offerIndex];

  // Update offer status
  acceptedOffer.status = "ACCEPTED";

  // Reject all other offers
  request.offers?.forEach((o, idx) => {
    if (idx !== offerIndex && o.status === "PENDING") {
      o.status = "REJECTED";
    }
  });

  // Assign provider
  request.assignedProvider = payload.providerId;
  request.status = "ASSIGNED";
  request.agreedPrice = acceptedOffer.proposedPrice;

  await request.save();

  // Notify winning provider
  const winningProvider = await Provider.findById(payload.providerId);
  await postNotification(
    "Offer Accepted! 🎉",
    `Customer accepted your offer of $${acceptedOffer.proposedPrice} for request ${request.requestId}. You can now start the work.`,
    payload.providerId
  );

  // Notify losing providers
  const rejectedOffers = request.offers.filter(o => o.status === "REJECTED");

  for (const rejectedOffer of rejectedOffers) {
    await postNotification(
      "Offer Not Accepted",
      `Customer chose another provider for request ${request.requestId}. Thank you for your interest.`,
      rejectedOffer.provider
    );
  }

  // Notify customer
  await postNotification(
    "Provider Assigned",
    `${winningProvider.companyName} has been assigned to your request ${request.requestId}.`,
    request.customerId
  );

  return await request.populate([
    { path: "assignedProvider", select: "companyName contactPerson phoneNumber" },
    { path: "serviceCategory", select: "name icon" }
  ]);
};

const ServiceRequestService = {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  getServiceRequestByIdDetails,
  updateServiceRequestStatus,
  assignProviderToRequest,
  getAllServiceRequests,
  getAllProviderService,
  completeServiceRequest,
  // New offer system functions
  submitOffer,
  viewOffers,
  acceptOffer
};

module.exports = { ServiceRequestService };
