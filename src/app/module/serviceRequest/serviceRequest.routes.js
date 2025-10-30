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
  .patch(
    "/update-status",
    auth(config.auth_level.provider),
    ServiceRequestController.updateServiceRequestStatus
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
  )
  .patch(
    "/assign-provider",
    auth(config.auth_level.admin),
    ServiceRequestController.assignProviderToRequest
  );

module.exports = router;