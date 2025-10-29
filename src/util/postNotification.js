const AdminNotification = require("../app/module/notification/AdminNotification");
const Notification = require("../app/module/notification/Notification");

// Plain async utility to create notifications for admin or a specific user
const postNotification = async (title, message, toId = null) => {
  if (!title || !message) {
    throw new Error("Missing required fields: title, or message");
  }

  if (!toId) {
    return await AdminNotification.create({ title, message });
  }
  return await Notification.create({ toId, title, message });
};

module.exports = postNotification;
