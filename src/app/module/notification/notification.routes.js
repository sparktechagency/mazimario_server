const express = require("express");
const auth = require("../../middleware/auth");
const config = require("../../../config");
const NotificationController = require("./notification.controller");

const router = express.Router();


//USER
router
  .post(
    "/create-notification",
    auth(config.auth_level.user),
    NotificationController.createNotification
  )
  .get( 
    "/get-notification",
    auth([...config.auth_level.user, ...config.auth_level.provider]),
    NotificationController.getNotification
  )
  .get(
    "/get-all-notifications",
    auth([...config.auth_level.user, ...config.auth_level.provider]),
    NotificationController.getAllNotifications
  )
  .patch(
    "/update-as-mark-unread",
    auth([...config.auth_level.user, ...config.auth_level.provider]),
    NotificationController.updateAsReadUnread
  )
  .delete(
    "/delete-notification",
    auth([...config.auth_level.user, ...config.auth_level.provider]),
    NotificationController.deleteNotification
  );

module.exports = router;
