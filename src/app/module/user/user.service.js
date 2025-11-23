const { status } = require("http-status");

const ApiError = require("../../../error/ApiError");
const User = require("./User");
const Auth = require("../auth/Auth");
const ServiceRequest = require("../serviceRequest/ServiceRequest");
const Review = require("../review/Review");
const unlinkFile = require("../../../util/unlinkFile");
const validateFields = require("../../../util/validateFields");
const QueryBuilder = require("../../../builder/queryBuilder");



const updateProfile = async (req) => {
  const { files, body: data } = req;
  const { userId, authId } = req.user;
  const updateData = { ...data };

  if (data?.profile_image === "")
    throw new ApiError(status.BAD_REQUEST, `Missing profile image`);

  const existingUser = await User.findById(userId).lean();

  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
    if (existingUser.profile_image) unlinkFile(existingUser.profile_image);
  }

  const [auth, user] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updateData.name },
      {
        new: true,
      }
    ),
    User.findByIdAndUpdate(
      userId,
      { ...updateData },
      {
        new: true,
      }
    ).populate("authId"),
  ]);

  if (!auth || !user) throw new ApiError(status.NOT_FOUND, "User not found!");

  return user;
};

const getProfile = async (userData) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    User.findById(userId).populate("authId").lean(),
  ]);

  // if (!result.isSubscribed)
  //   throw new ApiError(status.FORBIDDEN, "Not subscribed");

  if (!result || !auth) throw new ApiError(status.NOT_FOUND, "User not found");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  return result;
};

const deleteMyAccount = async (payload) => {
  const { email, password } = payload;

  const isUserExist = await Auth.isAuthExist(email);
  if (!isUserExist) throw new ApiError(status.NOT_FOUND, "User does not exist");
  if (
    isUserExist.password &&
    !(await Auth.isPasswordMatched(password, isUserExist.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  Promise.all([
    Auth.deleteOne({ email }),
    User.deleteOne({ authId: isUserExist._id }),
  ]);
};

const getUser = async (query) => {
  validateFields(query, ["userId"]);

  // Get user with populated auth and favorite categories
  const user = await User.findOne({ _id: query.userId })
    .populate("authId", "-password -__v -createdAt -updatedAt")
    .populate("favorites.categories.categoryId", "name icon isActive")
    .lean();

  if (!user) throw new ApiError(status.NOT_FOUND, "User not found");

  // Get all service requests for this user
  const serviceRequests = await ServiceRequest.find({ customerId: query.userId })
    .populate("serviceCategory", "name icon")
    .populate("assignedProvider", "name email phoneNumber profile_image")
    .populate("potentialProviders.providerId", "name email phoneNumber profile_image")
    .sort({ createdAt: -1 })
    .lean();

  // Get all reviews by this user
  const reviews = await Review.find({ user: query.userId })
    .populate("providerId", "name email phoneNumber profile_image")
    .sort({ createdAt: -1 })
    .lean();

  // Return comprehensive user information
  return {
    ...user,
    serviceRequests,
    reviews,
    stats: {
      totalRequests: serviceRequests.length,
      pendingRequests: serviceRequests.filter(r => r.status === "PENDING").length,
      assignedRequests: serviceRequests.filter(r => r.status === "ASSIGNED").length,
      processingRequests: serviceRequests.filter(r => r.status === "PROCESSING").length,
      completedRequests: serviceRequests.filter(r => r.status === "COMPLETED").length,
      totalReviews: reviews.length,
      averageRating: reviews.length > 0 
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
        : 0
    }
  };
};

const getAllUsers = async (userData, query) => {
  const userQuery = new QueryBuilder(
    User.find({}).populate("authId", "name email profile_image").select("profile_image name email phoneNumber").lean(),
    query
  )
    .search(["email", "name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [users, meta] = await Promise.all([
    userQuery.modelQuery,
    userQuery.countTotal(),
  ]);

  return {
    meta,
    users,
  };
};

const updateBlockUnblockUser = async (userData, payload) => {
  validateFields(payload, ["authId", "isBlocked"]);
  const { authId, isBlocked } = payload;

  const user = await Auth.findByIdAndUpdate(
    authId,
    { isBlocked },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(status.NOT_FOUND, "User not found");

  return user;
};

const UserService = {
  getProfile,
  deleteMyAccount,
  updateProfile,
  getUser,
  getAllUsers,
  updateBlockUnblockUser,
};

module.exports = { UserService };
