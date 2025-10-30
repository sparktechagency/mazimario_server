const { status } = require("http-status");

const ApiError = require("../../../error/ApiError");
const QueryBuilder = require("../../../builder/queryBuilder");
const postNotification = require("../../../util/postNotification");
const validateFields = require("../../../util/validateFields");
const { default: mongoose } = require("mongoose");
const { EnumUserRole } = require("../../../util/enum");
const Review = require("./Review");
const Provider = require("../provider/Provider");
const User = require("../user/User");


const postReview = async (userData, payload) => {
  validateFields(payload, ["rating", "review"]);

  const { userId } = userData;
  const { providerId } = payload || {};
  const reviewData = {
    user: userId,
    providerId: providerId,
    ...payload,
  };
  const providerObjectId = mongoose.Types.ObjectId.createFromHexString(providerId);

  validateFields(payload, ["providerId", "rating", "review"]);

  const provider = await Provider.findById(payload.providerId).select("user make").lean();
  if (!provider) throw new ApiError(status.NOT_FOUND, "Provider not found");
  reviewData.host = provider.user;

  const result = await Review.create(reviewData);
  // console.log(result);
  const avgProviderRatingAgg = await Review.aggregate([
    {
      $match: { providerId: providerObjectId },
    },
    {
      $group: {
        _id: "$providerId",
        avgRating: {
          $avg: "$rating",
        },
      },
    },
  ]);

  const avgHostRatingAgg = await User.aggregate([
    {
      $match: { _id: provider.user },
    },
    {
      $group: {
        _id: "$user",
        avgRating: {
          $avg: "$rating",
        },
      },
    },
  ]);

  // Defensive fallback for aggregation results
  const avgProviderRating = avgProviderRatingAgg[0]?.avgRating
    ? Number(avgProviderRatingAgg[0].avgRating.toFixed(2))
    : 0;
  const avgHostRating = avgHostRatingAgg[0]?.avgRating
    ? Number(avgHostRatingAgg[0].avgRating.toFixed(2))
    : 0;

  // Calculate the total number of reviews for the provider
  const totalReviews = await Review.countDocuments({ providerId: providerObjectId });

  // Update provider's rating and totalReviews fields
  Promise.all([
    Provider.updateOne(
      { _id: providerId },
      { rating: avgProviderRating, totalReviews },
      { new: true, runValidators: true }
    ),
    User.updateOne(
      { _id: provider.user },
      { rating: avgHostRating },
      { new: true, runValidators: true }
    ),
  ]);

  postNotification(
    "New Review Alert",
    `You've received a new ${payload.rating}-star review.`,
    provider.user
  );

  return result;
};

const getAllReviews = async (userData, query) => {
  const queryObj =
    userData.role === EnumUserRole.ADMIN ? {} : { user: userData.userId };

  const reviewQuery = new QueryBuilder(
    Review.find(queryObj)
      .populate([
        {
          path: "user",
          select: "-createdAt -updatedAt -__v",
        },
      ])
      .lean(),
    query
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    reviewQuery.modelQuery,
    reviewQuery.countTotal(),
  ]);

  return {
    meta,
    result,
  };
};

const getReview = async (userData, query) => {
  validateFields(query, ["reviewId"]);

  const review = await Review.findById(query.reviewId).lean();
  if (!review) throw new ApiError(status.NOT_FOUND, "Review not found");

  return review;
};

const updateReview = async (userData, payload) => {
  validateFields(payload, ["reviewId"]);

  const updateData = {
    ...(payload.rating && { rating: payload.rating }),
    ...(payload.review && { review: payload.review }),
  };

  const result = await Review.findByIdAndUpdate(
    payload.reviewId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!result) throw new ApiError(status.NOT_FOUND, "Review not found");

  return result;
};

const deleteReview = async (userData, payload) => {
  validateFields(payload, ["reviewId"]);

  const result = await Review.deleteOne({ _id: payload.reviewId });

  if (!result.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Review not found");

  return result;
};

const getReviewsForProvider = async (userData, query) => {
  // Find Provider by authId since JWT userId doesn't match Provider._id
  const authIdObj = mongoose.Types.ObjectId.createFromHexString(userData.authId);
  
  // Check if multiple providers exist with same authId
  const allProvidersWithAuthId = await Provider.find({ authId: authIdObj }).select("_id").lean();
  console.log("Providers found with this authId:", allProvidersWithAuthId.length);
  console.log("Provider IDs:", allProvidersWithAuthId.map(p => p._id.toString()));
  
  const provider = await Provider.findOne({ authId: authIdObj })
    .select("_id rating")
    .lean();

  if (!provider) throw new ApiError(status.NOT_FOUND, "Provider not found");
  
  const providerId = provider._id;
  
  console.log("Provider._id selected by findOne:", providerId);
  console.log("userData.userId from JWT:", userData.userId);
  console.log("Do they match?", providerId.toString() === userData.userId);
  
  // Test direct query without QueryBuilder
  const directTest = await Review.find({ providerId }).lean();
  console.log("Direct query result count:", directTest.length);
  console.log("Direct query results:", directTest);

  const reviewQuery = new QueryBuilder(
    Review.find({ providerId })
      .populate([{ path: "user", select: "-createdAt -updatedAt -__v" }])
      .lean(),
    query
  )
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [result, meta] = await Promise.all([
    reviewQuery.modelQuery,
    reviewQuery.countTotal(),
  ]);
  
  console.log("QueryBuilder result count:", result.length);
  console.log("QueryBuilder results:", result);

  // avgRating tracked on Provider
  const avgRating = provider.rating != null ? Number(parseFloat(provider.rating).toFixed(1)) : 0;

  // Total review count (unpaginated)
  const totalReviews = await Review.countDocuments({ providerId });

  return {
    meta: { ...meta, totalReviews },
    result,
    avgRating,
  };
};

const ReviewService = {
  postReview,
  getAllReviews,
  getReview,
  deleteReview,
  updateReview,
  getReviewsForProvider,
};

module.exports = ReviewService;
