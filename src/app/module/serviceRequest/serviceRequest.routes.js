const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { ServiceRequestController } = require("./serviceRequest.controller");
const config = require("../../../config");

const router = express.Router();

// User routes
router
  .post(
    "/create",
    auth(config.auth_level.user),
    uploadFile([{ name: "attachments", maxCount: 5 }]),
    ServiceRequestController.createServiceRequest
  )
  .get(
    "/my-requests",
    auth(config.auth_level.user),
    ServiceRequestController.getServiceRequests
  )
  .get(
    "/get-by-id",
    auth(config.auth_level.user),
    ServiceRequestController.getServiceRequestById
  )
  .get(
    "/details",
    auth(config.auth_level.user),
    ServiceRequestController.getServiceRequestByIdDetails
  )
  // NEW: Customer views all provider offers
  .get(
    "/view-offers",
    auth(config.auth_level.user),
    ServiceRequestController.viewOffers
  )
  // NEW: Customer accepts a provider's offer
  .post(
    "/accept-offer",
    auth(config.auth_level.user),
    ServiceRequestController.acceptOffer
  )
  .patch(
    "/update-status",
    auth(config.auth_level.user),
    ServiceRequestController.updateServiceRequestStatus
  );

// Provider routes
router
  .get(
    "/assigned-requests",
    auth(config.auth_level.provider),
    ServiceRequestController.getServiceRequests
  )
  .get(
    "/details",
    auth(config.auth_level.provider),
    ServiceRequestController.getServiceRequestByIdDetails
  )
  // DEPRECATED: Use update-status endpoint instead
  // .patch(
  //   "/update-status",
  //   auth(config.auth_level.provider),
  //   ServiceRequestController.updateServiceRequestStatus
  // )
  // NEW: Provider submits offer/proposal
  .post(
    "/submit-offer",
    auth(config.auth_level.provider),
    ServiceRequestController.submitOffer
  )
  .patch(
    "/update-status",
    auth(config.auth_level.provider),
    ServiceRequestController.updateServiceRequestStatus
  )
  .post(
    "/complete",
    auth(config.auth_level.provider),
    uploadFile([{ name: "completionProof", maxCount: 5 }]),
    ServiceRequestController.completeServiceRequest
  );

// Admin routes
router
  .get(
    "/get-all",
    auth(config.auth_level.admin),
    ServiceRequestController.getAllServiceRequests
  )
  .get(
    "/get-by-id",
    auth(config.auth_level.admin),
    ServiceRequestController.getServiceRequestById
  );
// COMMENTED OUT: Customers now accept offers directly, no need for admin to assign
// .patch(
//   "/assign-provider",
//   auth(config.auth_level.admin),
//   ServiceRequestController.assignProviderToRequest
// );

module.exports = router;