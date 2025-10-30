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
    provider: providerId,
    ...payload,
  };
  const providerObjectId = mongoose.Types.ObjectId.createFromHexString(providerId);

  validateFields(payload, ["providerId", "rating", "review"]);

  const provider = await Provider.findById(payload.providerId).select("user make").lean();
  if (!provider) throw new ApiError(status.NOT_FOUND, "Provider not found");
  reviewData.host = provider.user;

  const result = await Review.create(reviewData);

  const avgProviderRatingAgg = await Review.aggregate([
    {
      $match: { provider: providerObjectId },
    },
    {
      $group: {
        _id: "$provider",
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

  const avgProviderRating = avgProviderRatingAgg[0].avgRating.toFixed(2) ?? 0;
  const avgHostRating = avgHostRatingAgg[0].avgRating.toFixed(2) ?? 0;

  Promise.all([
    Provider.updateOne(
      { _id: providerId },
      { rating: avgProviderRating },
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

const ReviewService = {
  postReview,
  getAllReviews,
  getReview,
  deleteReview,
  updateReview,
};

module.exports = ReviewService;
