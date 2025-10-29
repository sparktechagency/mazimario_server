const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { ProviderController } = require("./provider.controller");
const config = require("../../../config");

const router = express.Router();

// Provider routes
router
  .post(
    "/provider-register",
    auth(config.auth_level.provider),
    uploadFile([
      { name: "attachments", maxCount: 5 },
    ]),
    ProviderController.registerProvider
  )
  .get(
    "/profile",
    auth(config.auth_level.provider),
    ProviderController.getProviderProfile
  )
  .patch(
    "/update-profile",
    auth(config.auth_level.provider),
    uploadFile([
      { name: "attachments", maxCount: 5 },
    ]),
    ProviderController.updateProviderProfile
  )
  .patch(
    "/toggle-status",
    auth(config.auth_level.provider),
    ProviderController.toggleProviderStatus
  )
  .get(
    "/potential-requests",
    auth(config.auth_level.provider),
    ProviderController.getPotentialRequests
  )
  .get(
    "/potential-request",
    auth(config.auth_level.provider),
    ProviderController.getPotentialRequestById
  )
  .patch(
    "/handle-request",
    auth(config.auth_level.provider),
    ProviderController.handleRequestResponse
  )
  .patch(
    "/mark-complete",
    auth(config.auth_level.provider),
    uploadFile([{ name: "completionProof", maxCount: 5 }]),
    ProviderController.markRequestComplete
  );

// Admin routes
router
  .get(
    "/get-all",
    auth(config.auth_level.admin),
    ProviderController.getAllProviders
  )
  .get(
    "/get",
    auth(config.auth_level.admin),
    ProviderController.getProviderById
  )
  .patch(
    "/verify",
    auth(config.auth_level.admin),
    ProviderController.verifyProvider
  );

module.exports = router;