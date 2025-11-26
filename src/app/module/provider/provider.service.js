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

// Payment hold helpers (temporary until real payment integration)
const isPaymentHoldActive = (serviceRequest) => {
  if (!serviceRequest) return false;
  if (serviceRequest.status !== "ON_PROCESS") return false;
  if (!serviceRequest.paymentHoldUntil) return false;
  if (serviceRequest.assignedProvider) return false;
  return new Date(serviceRequest.paymentHoldUntil) > new Date();
};

const expirePaymentHoldIfNeeded = (serviceRequest) => {
  if (!serviceRequest) return serviceRequest;
  const now = new Date();
  const holdExpired =
    serviceRequest.status === "ON_PROCESS" &&
    serviceRequest.paymentHoldUntil &&
    new Date(serviceRequest.paymentHoldUntil) <= now &&
    !serviceRequest.assignedProvider;

  if (holdExpired) {
    // Revert the held provider's status back to PENDING
    if (serviceRequest.paymentHoldBy) {
      const idx = serviceRequest.potentialProviders.findIndex(
        (pp) =>
          pp.providerId.toString() === serviceRequest.paymentHoldBy.toString()
      );
      if (idx !== -1) {
        serviceRequest.potentialProviders[idx].status = "PENDING";
        serviceRequest.potentialProviders[idx].paymentWindowStartedAt =
          undefined;
      }
    }

    serviceRequest.status = "PENDING";
    serviceRequest.paymentHoldBy = undefined;
    serviceRequest.paymentHoldUntil = undefined;
  }

  return serviceRequest;
};

// Helper function to match a provider with existing pending requests
const matchProviderWithPendingRequests = async (provider) => {
  // Find all PENDING service requests
  const pendingRequests = await ServiceRequest.find({
    status: "PENDING",
    serviceCategory: { $in: provider.serviceCategories }, // Match any of provider's categories
  }).select("_id serviceCategory latitude longitude potentialProviders");

  const matchedRequests = [];

  for (const request of pendingRequests) {
    // Check if provider is already in potentialProviders
    const alreadyAdded = request.potentialProviders.some(
      (pp) => pp.providerId.toString() === provider._id.toString()
    );

    if (alreadyAdded) continue;

    // Check distance
    const distance = calculateDistance(
      provider.latitude,
      provider.longitude,
      request.latitude,
      request.longitude
    );

    // Check if within range
    if (distance <= 50 && distance <= provider.coveredRadius) {
      const hasAvailability = provider.workingHours.some(
        (wh) => wh.isAvailable
      );

      if (hasAvailability) {
        matchedRequests.push(request._id);

        // Add provider to request's potentialProviders
        await ServiceRequest.findByIdAndUpdate(request._id, {
          $push: {
            potentialProviders: {
              providerId: provider._id,
              status: "PENDING",
            },
          },
        });
      }
    }
  }

  // Send notification to provider about matched requests
  if (matchedRequests.length > 0) {
    await postNotification(
      "New Service Requests Available",
      `You have ${matchedRequests.length} new service request(s) matching your services and location.`,
      provider._id
    );
  }

  return matchedRequests.length;
};

// Register Provider
const registerProvider = async (req) => {
  const { files, body: data, user } = req;

  validateFields(data, [
    "companyName",
    "serviceCategories", // Changed from serviceCategory to serviceCategories
    "serviceLocation",
    "contactPerson",
    "coveredRadius",
    "latitude",
    "longitude",
    "workingHours",
  ]);

  // Check if provider already exists with this auth ID
  const existingProvider = await Provider.findOne({ authId: user.authId });

  // Check if company name is already taken by another active provider
  const existingCompany = await Provider.findOne({
    companyName: data.companyName,
    isActive: true,
    _id: { $ne: existingProvider?._id },
  });

  if (existingCompany) {
    throw new ApiError(
      status.CONFLICT,
      "This company name is already registered. Please choose a different company name."
    );
  }

  // Parse and validate service categories (array of category IDs)
  const serviceCategories = JSON.parse(data.serviceCategories || "[]");

  if (!Array.isArray(serviceCategories) || serviceCategories.length === 0) {
    throw new ApiError(
      status.BAD_REQUEST,
      "At least one service category is required"
    );
  }

  // Validate all categories exist and are active
  for (const categoryId of serviceCategories) {
    const category = await Category.findOne({
      _id: categoryId,
      isActive: true,
    });

    if (!category) {
      throw new ApiError(
        status.BAD_REQUEST,
        `Invalid or inactive category: ${categoryId}`
      );
    }
  }

  const providerData = {
    authId: user.authId,
    companyName: data.companyName,
    website: data.website,
    serviceCategories: serviceCategories, // Array of category IDs
    latitude: parseFloat(data.latitude),
    longitude: parseFloat(data.longitude),
    coveredRadius: parseFloat(data.coveredRadius),
    serviceLocation: data.serviceLocation,
    contactPerson: data.contactPerson,
    workingHours: JSON.parse(data.workingHours || "[]"),
  };

  // Handle file uploads
  if (files && files.attachments) {
    providerData.attachments = files.attachments.map((file) => file.path);
  }

  const provider = await Provider.create(providerData);

  // Notify admin about new provider registration
  await postNotification(
    "New Provider Registered",
    `A new provider has been registered: ${provider.companyName}. Please verify them.`
  );

  // IMPORTANT: Match new provider with existing PENDING service requests
  // Only if provider is verified (admin can verify later, so this runs after verification too)
  if (provider.isVerified && provider.isActive) {
    await matchProviderWithPendingRequests(provider);
  }

  return provider;
};

// Get Provider Profile (full registration info)
const getProviderProfile = async (userData) => {
  // Find the LATEST provider by authId (sort by createdAt desc)
  const provider = await Provider.findOne({ authId: userData.authId })
    .sort({ createdAt: -1 }) // Get the most recent one
    .populate("serviceCategories", "name icon")
    .populate("authId", "name email")
    .lean();

  // console.log("Found provider:", provider);

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  // Add stats
  const [totalAssignedRequests, totalCompletedRequests, totalPendingRequests] =
    await Promise.all([
      ServiceRequest.countDocuments({ assignedProvider: provider._id }),
      ServiceRequest.countDocuments({
        assignedProvider: provider._id,
        status: "COMPLETED",
      }),
      ServiceRequest.countDocuments({
        "potentialProviders.providerId": provider._id,
        "potentialProviders.status": "PENDING",
        assignedProvider: { $exists: false },
      }),
    ]);

  const profile = {
    ...provider,
    stats: {
      totalAssignedRequests,
      totalCompletedRequests,
      totalPendingRequests,
      acceptanceRate:
        totalAssignedRequests > 0
          ? ((totalCompletedRequests / totalAssignedRequests) * 100).toFixed(1)
          : 0,
    },
  };

  return profile;
};

// Update Provider Profile (requires admin approval)
const updateProviderProfile = async (req) => {
  const { files, body: data, user } = req;

  // Find the LATEST provider by authId
  const existingProvider = await Provider.findOne({ authId: user.authId }).sort(
    { createdAt: -1 }
  );
  if (!existingProvider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  // Store updates in pendingUpdates for admin approval
  const updateData = {};

  if (data.companyName) updateData.companyName = data.companyName;
  if (data.website) updateData.website = data.website;
  if (data.serviceLocation) updateData.serviceLocation = data.serviceLocation;
  if (data.coveredRadius)
    updateData.coveredRadius = parseFloat(data.coveredRadius);
  if (data.contactPerson) updateData.contactPerson = data.contactPerson;

  if (data.latitude && data.longitude) {
    updateData.latitude = parseFloat(data.latitude);
    updateData.longitude = parseFloat(data.longitude);
  }

  if (data.workingHours) {
    updateData.workingHours = JSON.parse(data.workingHours);
  }

  // Handle file uploads
  if (files && files.profile_image) {
    // Only ONE profile image allowed
    updateData.profile_image = files.profile_image[0].path;
  } else if (files && files.attachments) {
    updateData.attachments = files.attachments.map((file) => file.path);
  } else {
    updateData.profile_image = existingProvider.profile_image;
    updateData.attachments = existingProvider.attachments;
  }

  // Store updates in pendingUpdates field for admin approval
  existingProvider.pendingUpdates = updateData;
  await existingProvider.save();

  // Notify admin about the update request
  await postNotification(
    "Provider Update Request",
    `${existingProvider.companyName} has submitted a profile update request for approval.`
  );

  return { message: "Update request submitted for admin approval" };
};

// Toggle Provider Active Status
const toggleProviderStatus = async (userData, payload) => {
  validateFields(payload, ["isActive"]);

  // Find the LATEST provider by authId
  const provider = await Provider.findOne({ authId: userData.authId }).sort({
    createdAt: -1,
  });
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  provider.isActive = payload.isActive;
  await provider.save();

  return provider;
};

// Get Potential Requests for Provider
// const getPotentialRequests = async (userData, query) => {
//   // Find the LATEST provider by authId (same as getProviderProfile)
//   const provider = await Provider.findOne({ authId: userData.authId })
//     .sort({ createdAt: -1 });

//   if (!provider || !provider.isActive) {
//     throw new ApiError(status.NOT_FOUND, "Provider not found or inactive");
//   }

//   // Find requests where this provider is in potentialProviders array with PENDING status
//   const requests = await ServiceRequest.find({
//     potentialProviders: {
//       $elemMatch: {
//         providerId: provider._id,
//         status: "PENDING"
//       }
//     }
//   })
//     // .populate("customerId", "name email phoneNumber")
//     .populate("serviceCategory", "name icon")
//     // .populate("potentialProviders.providerId", "companyName")
//     .lean();

//   return {
//     meta: {
//       page: 1,
//       limit: requests.length,
//       total: requests.length,
//       totalPages: 1,
//     },
//     requests: requests,
//   };
// };

const getPotentialRequests = async (userData, query) => {
  // Find the latest provider by authId
  const provider = await Provider.findOne({ authId: userData.authId }).sort({
    createdAt: -1,
  });

  if (!provider || !provider.isActive) {
    throw new ApiError(status.NOT_FOUND, "Provider not found or inactive");
  }

  // Extract potentialProvider status filter from query (default to PENDING)
  const providerStatus = query.providerStatus || "PENDING";

  // Remove providerStatus from query to avoid QueryBuilder confusion
  const { providerStatus: _, status: __, ...cleanQuery } = query;

  // Base query: match this provider inside potentialProviders array
  const baseQuery = ServiceRequest.find({
    potentialProviders: {
      $elemMatch: {
        providerId: provider._id,
        status: providerStatus, // Filter by potentialProviders status only
      },
    },
  })
    .populate("customerId", "name email phoneNumber")
    .populate("serviceCategory", "name icon")
    .lean();

  // Use QueryBuilder for filtering, sorting, pagination (without status field)
  const queryBuilder = new QueryBuilder(baseQuery, cleanQuery)
    .filter()
    .sort()
    .paginate()
    .fields();

  const requests = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    requests,
  };
};

const getPotentialRequestById = async (userData, query) => {
  validateFields(query, ["requestId"]);

  const provider = await Provider.findOne({ authId: userData.authId }).sort({
    createdAt: -1,
  });

  if (!provider || !provider.isActive) {
    throw new ApiError(status.NOT_FOUND, "Provider not found or inactive");
  }

  const requests = await ServiceRequest.findById(query.requestId)
    .populate("customerId", "name email phoneNumber")
    .populate("serviceCategory", "name icon")
    .lean();

  return {
    meta: {
      page: 1,
      limit: requests.length,
      total: requests.length,
      totalPages: 1,
    },
    requests: requests,
  };
};

// Handle Request Response (Accept/Decline)
// const handleRequestResponse = async (userData, payload) => {
//   validateFields(payload, ["requestId", "action"]);

//   const provider = await Provider.findOne({ authId: userData.authId });
//   const serviceRequest = await ServiceRequest.findById(payload.requestId);

//   if (!provider || !serviceRequest) {
//     throw new ApiError(status.NOT_FOUND, "Provider or request not found");
//   }

//   const potentialProviderIndex = serviceRequest.potentialProviders.findIndex(
//     pp => pp.providerId.toString() === provider._id.toString()
//   );

//   if (potentialProviderIndex === -1) {
//     throw new ApiError(status.BAD_REQUEST, "Request not available for this provider");
//   }

//   if (payload.action === "ACCEPT") {
//     serviceRequest.potentialProviders[potentialProviderIndex].status = "ACCEPTED";
//     serviceRequest.potentialProviders[potentialProviderIndex].acceptedAt = new Date();
//     serviceRequest.status = "PROCESSING";
//   } else if (payload.action === "DECLINE") {
//     serviceRequest.potentialProviders[potentialProviderIndex].status = "DECLINED";
//     serviceRequest.potentialProviders[potentialProviderIndex].declinedAt = new Date();
//   }

//   await serviceRequest.save();
//   return { message: `Request ${payload.action.toLowerCase()}ed successfully` };
// };

const handleRequestResponse = async (userData, payload) => {
  validateFields(payload, ["requestId", "action"]);

  // Find the LATEST provider by authId
  const provider = await Provider.findOne({ authId: userData.authId }).sort({
    createdAt: -1,
  });
  const serviceRequest = await ServiceRequest.findById(payload.requestId);

  if (!provider || !serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Provider or request not found");
  }

  // Lazily expire any stale payment hold
  expirePaymentHoldIfNeeded(serviceRequest);

  const potentialProviderIndex = serviceRequest.potentialProviders.findIndex(
    (pp) => pp.providerId.toString() === provider._id.toString()
  );

  if (potentialProviderIndex === -1) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Request not available for this provider"
    );
  }

  if (payload.action === "ACCEPT") {
    const now = new Date();

    // If another provider currently holds the payment window, block
    if (
      isPaymentHoldActive(serviceRequest) &&
      serviceRequest.paymentHoldBy &&
      serviceRequest.paymentHoldBy.toString() !== provider._id.toString()
    ) {
      throw new ApiError(
        status.CONFLICT,
        "This request is currently in payment process by another provider. Please try again later."
      );
    }

    // Check if provider has already paid or needs to pay
    if (serviceRequest.leadFee > 0) {
      // Start a 5-minute payment hold window
      const fiveMinutesMs = 5 * 60 * 1000;
      serviceRequest.potentialProviders[potentialProviderIndex].status =
        "PAYMENT_PENDING";
      serviceRequest.potentialProviders[
        potentialProviderIndex
      ].paymentWindowStartedAt = now;
      serviceRequest.status = "ON_PROCESS"; // visible to others as "on process"
      serviceRequest.paymentHoldBy = provider._id;
      serviceRequest.paymentHoldUntil = new Date(now.getTime() + fiveMinutesMs);

      // Do NOT assign yet; assignment will happen after payment confirmation
    } else {
      // No lead fee, directly assign to provider
      serviceRequest.potentialProviders[potentialProviderIndex].status =
        "ACCEPTED";
      serviceRequest.potentialProviders[potentialProviderIndex].acceptedAt =
        now;
      serviceRequest.assignedProvider = provider._id;
      serviceRequest.status = "PROCESSING";
      // Clear any residual hold data
      serviceRequest.paymentHoldBy = undefined;
      serviceRequest.paymentHoldUntil = undefined;
    }
  } else if (payload.action === "DECLINE" || payload.action === "DECLINED") {
    // Update provider status to DECLINED instead of removing
    serviceRequest.potentialProviders[potentialProviderIndex].status =
      "DECLINED";
    serviceRequest.potentialProviders[potentialProviderIndex].declinedAt =
      new Date();

    // If the declining provider was holding the payment window, release it
    if (
      serviceRequest.paymentHoldBy &&
      serviceRequest.paymentHoldBy.toString() === provider._id.toString()
    ) {
      serviceRequest.paymentHoldBy = undefined;
      serviceRequest.paymentHoldUntil = undefined;
      // Only revert main status if not assigned
      if (!serviceRequest.assignedProvider) {
        serviceRequest.status = "PENDING";
      }
    }
  }

  await serviceRequest.save();

  //send notification
  await Promise.all([
    //send notification to customer
    postNotification(
      "Request " + payload.action.toLowerCase() + "ed",
      "Your request has been " +
      payload.action.toLowerCase() +
      "ed by the provider.",
      serviceRequest.customerId
    ),

    //send notification to provider
    postNotification(
      "You " + payload.action.toLowerCase() + "ed a new service request",
      "Service category : " +
      serviceRequest.subcategory +
      " , address: " +
      serviceRequest.address +
      " , customer contact: " +
      serviceRequest.customerPhone +
      ", priority level: " +
      serviceRequest.priority,
      provider._id
    ),

    //send notification to admin
    postNotification(
      "A new service request found service provider",
      "A service provider accepted a new service request from a customer. Service address: " +
      serviceRequest.address +
      ", priority level: " +
      serviceRequest.priority,
      serviceRequest.customerId
    ),
  ]);

  if (payload.action === "ACCEPT") {
    return {
      message: "Request accepted successfully",
      requiresPayment: serviceRequest.leadFee > 0,
      leadFee: serviceRequest.leadFee,
      paymentHoldUntil: serviceRequest.paymentHoldUntil || null,
    };
  } else {
    return { message: "Request declined successfully" };
  }
};

// Mark Request as Complete
const markRequestComplete = async (req) => {
  const { files, body: data, user } = req;
  validateFields(data, ["requestId"]);

  // Find the LATEST provider by authId
  const provider = await Provider.findOne({ authId: user.authId }).sort({
    createdAt: -1,
  });
  const serviceRequest = await ServiceRequest.findOne({
    _id: data.requestId,
    assignedProvider: provider._id,
    status: "PROCESSING",
  });

  // console.log(
  //   "serviceRequest",
  //   await ServiceRequest.findOne({
  //     _id: data.requestId,
  //     assignedProvider: provider._id,
  //     // status: "ACCEPTED",
  //   })
  // );

  if (!serviceRequest) {
    throw new ApiError(
      status.NOT_FOUND,
      "Request not found or not assigned to you"
    );
  }

  // Handle completion proof uploads
  if (files && files.completionProof) {
    serviceRequest.completionProof = files.completionProof.map(
      (file) => file.path
    );
  }

  serviceRequest.status = "COMPLETED";
  await serviceRequest.save();
  await postNotification(
    "Request Marked as Completed",
    "Your request has been marked as completed by the provider.",
    serviceRequest.customerId
  );

  return { message: "Request marked as completed successfully" };
};

// Temporary helper: confirm payment to finalize assignment
const confirmLeadPayment = async (userData, payload) => {
  validateFields(payload, ["requestId"]);

  // Find latest provider
  const provider = await Provider.findOne({ authId: userData.authId }).sort({
    createdAt: -1,
  });
  const serviceRequest = await ServiceRequest.findById(payload.requestId);

  if (!provider || !serviceRequest) {
    throw new ApiError(status.NOT_FOUND, "Provider or request not found");
  }

  // Expire stale hold if needed
  expirePaymentHoldIfNeeded(serviceRequest);

  // Must be the holding provider within window
  if (
    !serviceRequest.paymentHoldBy ||
    serviceRequest.paymentHoldBy.toString() !== provider._id.toString()
  ) {
    throw new ApiError(
      status.CONFLICT,
      "No active payment window for this provider"
    );
  }

  if (!isPaymentHoldActive(serviceRequest)) {
    throw new ApiError(status.CONFLICT, "Payment window has expired");
  }

  // Finalize assignment
  const idx = serviceRequest.potentialProviders.findIndex(
    (pp) => pp.providerId.toString() === provider._id.toString()
  );
  if (idx === -1) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Provider not part of potential list"
    );
  }

  serviceRequest.potentialProviders[idx].status = "PAID";
  serviceRequest.potentialProviders[idx].paidAt = new Date();
  serviceRequest.assignedProvider = provider._id;
  serviceRequest.status = "PROCESSING";
  serviceRequest.paymentHoldBy = undefined;
  serviceRequest.paymentHoldUntil = undefined;

  await serviceRequest.save();

  return { message: "Payment confirmed and request assigned" };
};

// Get All Providers (Admin)
const getAllProviders = async (query) => {
  const providerQuery = new QueryBuilder(
    Provider.find({})
      .populate("serviceCategories", "name icon")
      .populate("authId", "name email profile_image isVerified phoneNumber website")
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

// Get Provider by ID
const getProviderById = async (id) => {
  const provider = await Provider.findById(id)
    .populate("serviceCategories", "name icon")
    .populate("authId", "name email profile_image isVerified phoneNumber website");

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  return provider;
};

// Verify Provider (Admin)
const verifyProvider = async (payload) => {
  validateFields(payload, ["providerId", "isVerified", "isRejected"]);

  const provider = await Provider.findById(payload.providerId);

  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  const wasUnverified = !provider.isVerified;
  provider.isVerified = payload.isVerified;
  provider.isRejected = payload.isRejected;
  await provider.save();

  // If provider just got verified and is active, match with pending requests
  if (wasUnverified && payload.isVerified && provider.isActive) {
    await matchProviderWithPendingRequests(provider);
  }

  return provider;
};

// Get Providers with Pending Updates (Admin)
const getPendingProviderUpdates = async () => {
  const providers = await Provider.find({
    pendingUpdates: { $ne: null },
  })
    .select("companyName email phone pendingUpdates createdAt updatedAt")
    .populate("authId", "email")
    .sort({ updatedAt: -1 });

  return providers;
};

// Approve Provider Update (Admin)
const approveProviderUpdate = async (payload) => {
  validateFields(payload, ["providerId"]);

  const provider = await Provider.findById(payload.providerId);
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  if (!provider.pendingUpdates) {
    throw new ApiError(
      status.BAD_REQUEST,
      "No pending updates for this provider"
    );
  }

  // Apply the pending updates to the provider
  Object.assign(provider, provider.pendingUpdates);

  // Clear pending updates
  provider.pendingUpdates = null;
  await provider.save();
  console.log("provider", provider._id);

  // Notify provider that their update was approved
  await postNotification(
    "Profile Update Approved",
    "Your profile update request has been approved by admin.",
    provider._id
  );
  // console.log(
  //   await postNotification(
  //     "Profile Update Approved",
  //     "Your profile update request has been approved by admin.",
  //     provider._id
  //   )
  // );

  return { message: "Provider update approved successfully", provider };
};

// Reject Provider Update (Admin)
const rejectProviderUpdate = async (payload) => {
  validateFields(payload, ["providerId"]);

  const provider = await Provider.findById(payload.providerId);
  if (!provider) {
    throw new ApiError(status.NOT_FOUND, "Provider not found");
  }

  if (!provider.pendingUpdates) {
    throw new ApiError(
      status.BAD_REQUEST,
      "No pending updates for this provider"
    );
  }

  // Clear pending updates without applying them
  provider.pendingUpdates = null;
  await provider.save();

  // Notify provider that their update was rejected
  const reason = payload.reason || "No reason provided";
  await postNotification(
    "Profile Update Rejected",
    `Your profile update request has been rejected by admin. Reason: ${reason}`,
    provider._id
  );

  return { message: "Provider update rejected successfully" };
};

module.exports = {
  registerProvider,
  getProviderProfile,
  updateProviderProfile,
  toggleProviderStatus,
  getPotentialRequests,
  getPotentialRequestById,
  handleRequestResponse,
  confirmLeadPayment,
  markRequestComplete,
  getAllProviders,
  getProviderById,
  verifyProvider,
  getPendingProviderUpdates,
  approveProviderUpdate,
  rejectProviderUpdate,
};
