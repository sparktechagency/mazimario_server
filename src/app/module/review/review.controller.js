const ReviewService = require("./review.service");
const sendResponse = require("../../../util/sendResponse");
const catchAsync = require("../../../util/catchAsync");

const postReview = catchAsync(async (req, res) => {
  const result = await ReviewService.postReview(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review posted",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req, res) => {
  const result = await ReviewService.getAllReviews(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review retrieved",
    data: result,
  });
});

const getReview = catchAsync(async (req, res) => {
  const result = await ReviewService.getReview(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review retrieved",
    data: result,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const result = await ReviewService.updateReview(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review updated",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const result = await ReviewService.deleteReview(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review deleted",
    data: result,
  });
});

const getReviewsForProvider = catchAsync(async (req, res) => {
  // console.log("req.user",req.user);
  const result = await ReviewService.getReviewsForProvider(req.user, req.query);
  // console.log("result",result);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider reviews retrieved",
    data: result,
  });
});

const ReviewController = {
  postReview,
  getAllReviews,
  getReview,
  updateReview,
  deleteReview,
  getReviewsForProvider,
};

module.exports = ReviewController;
