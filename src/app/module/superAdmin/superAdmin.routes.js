const auth = require("../../middleware/auth");
const express = require("express");
const { uploadFile } = require("../../middleware/fileUploader");
const { SuperAdminController } = require("./superAdmin.controller");
const config = require("../../../config");

const router = express.Router();

router
  .get(
    "/profile",
    auth(config.auth_level.super_admin),
    SuperAdminController.getProfile
  )
  .patch(
    "/edit-profile",
    auth(config.auth_level.super_admin),
    uploadFile(),
    SuperAdminController.updateProfile
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.super_admin),
    SuperAdminController.deleteMyAccount
  );

module.exports = router;
