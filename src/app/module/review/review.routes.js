const express = require("express");
const auth = require("../../middleware/auth");
const ReviewController = require("./review.controller");
const config = require("../../../config");

const router = express.Router();

router
  .post(
    "/post-review",
    auth(config.auth_level.user),
    ReviewController.postReview
  )
  .get(
    "/get-all-reviews",
    auth(config.auth_level.user),
    ReviewController.getAllReviews
  )
  .get("/get-review", auth(config.auth_level.user), ReviewController.getReview)
  .patch(
    "/update-review",
    auth(config.auth_level.user),
    ReviewController.updateReview
  )
  .delete(
    "/delete-review",
    auth(config.auth_level.user),
    ReviewController.deleteReview
  );


  // get reviews for provider

  router.get(
    "/get-reviews-for-provider",
    auth(config.auth_level.provider), // or user, depending on your roles
    ReviewController.getReviewsForProvider
  );

  router.get(
    "/get-provider-reviews",
    auth(config.auth_level.provider),
    ReviewController.getReviewsForProvider
  );

module.exports = router;
