const { default: status } = require("http-status");
const QueryBuilder = require("../../../builder/queryBuilder");
const ApiError = require("../../../error/ApiError");
const validateFields = require("../../../util/validateFields");
const Notification = require("./Notification");
const { EnumUserRole } = require("../../../util/enum");
const AdminNotification = require("./AdminNotification");

const createNotification = async (userData, payload) => {
  const { role } = userData;

  validateFields(payload, ["title", "message", "toId"]);

  const Model = role === EnumUserRole.ADMIN ? AdminNotification : Notification;

  const notification = await Model.create({
    toId: payload.toId,
    title: payload.title,
    message: payload.message,
    isRead: false,
  });

  return notification;
};

const getNotification = async (userData, query) => {
  const { role, userId } = userData;
  const Model = role === EnumUserRole.ADMIN ? AdminNotification : Notification;

  if (role !== EnumUserRole.ADMIN) validateFields(query, ["notificationId"]);

  const queryObj =
    role === EnumUserRole.ADMIN 
      ? {} 
      : { _id: query.notificationId, toId: userId }; // Verify ownership

  const notification = await Model.findOne(queryObj).lean();

  if (!notification)
    throw new ApiError(status.NOT_FOUND, "Notification not found");

  return notification;
};

/**
 * Retrieves notifications based on the user's role.
 *
 * - If the user is an **admin**, it fetches all notifications from `AdminNotification`.
 * - If the user is a **regular user**, it fetches only notifications relevant to them from `Notification`.
 */
const getAllNotifications = async (userData, query) => {
  const { role, userId } = userData;

  // Admin gets AdminNotification, USER and PROVIDER get Notification filtered by toId
  const Model = role === EnumUserRole.ADMIN ? AdminNotification : Notification;
  const queryObj = role === EnumUserRole.ADMIN ? {} : { toId: userId };

  const notificationQuery = new QueryBuilder(Model.find(queryObj).lean(), query)
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [notification, meta] = await Promise.all([
    notificationQuery.modelQuery,
    notificationQuery.countTotal(),
  ]);

  return {
    meta,
    notification,
  };
};

const updateAsReadUnread = async (userData, payload) => {
  const { role, userId } = userData;

  // Admin uses AdminNotification, USER and PROVIDER use Notification
  const Model = role === EnumUserRole.ADMIN ? AdminNotification : Notification;
  const queryObj = role === EnumUserRole.ADMIN ? {} : { toId: userId };
  queryObj.isRead = !payload.isRead;

  const result = await Model.updateMany(queryObj, {
    $set: { isRead: payload.isRead },
  });

  return result;
};

const deleteNotification = async (userData, payload) => {
  validateFields(payload, ["notificationId"]);

  const { role, userId } = userData;
  const Model = role === EnumUserRole.ADMIN ? AdminNotification : Notification;

  // Verify ownership before deleting
  const queryObj = role === EnumUserRole.ADMIN 
    ? { _id: payload.notificationId }
    : { _id: payload.notificationId, toId: userId };

  const notification = await Model.deleteOne(queryObj);

  if (!notification.deletedCount)
    throw new ApiError(status.NOT_FOUND, "Notification not found");

  return notification;
};

const NotificationService = {
  getNotification,
  getAllNotifications,
  updateAsReadUnread,
  deleteNotification,
  createNotification,
};

module.exports = NotificationService;
