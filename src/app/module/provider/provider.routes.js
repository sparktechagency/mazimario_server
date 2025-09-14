const express = require("express");
const auth = require("../../middleware/auth");
const { uploadFile } = require("../../middleware/fileUploader");
const { ProviderController } = require("./provider.controller");
const config = require("../../../config");

const router = express.Router();

// Provider routes (requires provider authentication)
router
  .post(
    "/register",
    auth(config.auth_level.user),
    uploadFile([{ name: "licenses", maxCount: 5 }, { name: "certificates", maxCount: 5 }]),
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
    uploadFile([{ name: "licenses", maxCount: 5 }, { name: "certificates", maxCount: 5 }]),
    ProviderController.updateProviderProfile
  );

// Admin routes (requires admin authentication)
router
  .get(
    "/get-all",
    auth(config.auth_level.admin),
    ProviderController.getAllProviders
  )
  .get(
    "/get-by-id",
    auth(config.auth_level.admin),
    ProviderController.getProviderById
  )
  .patch(
    "/update-verification",
    auth(config.auth_level.admin),
    ProviderController.updateProviderVerification
  )
  .patch(
    "/update-status",
    auth(config.auth_level.admin),
    ProviderController.updateProviderStatus
  )
  .delete(
    "/delete",
    auth(config.auth_level.admin),
    ProviderController.deleteProvider
  );

// Public routes (no authentication required)
router.get(
  "/by-category",
  ProviderController.getProvidersByCategory
);

module.exports = router;