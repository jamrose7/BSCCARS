const express = require("express");
const router = express.Router();
const { getUserNotifications, addUserActivity } = require("../data/mockData");

// GET /api/notifications
router.get("/", (req, res) => {
  const notifications = getUserNotifications(req.user.id);
  res.json({ success: true, data: notifications });
});

// GET /api/notifications/unread
router.get("/unread", (req, res) => {
  const notifications = getUserNotifications(req.user.id).filter(
    (notification) => !notification.is_read,
  );
  res.json({ success: true, data: notifications });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", (req, res) => {
  const notifications = getUserNotifications(req.user.id);
  const notification = notifications.find((item) => item.id === req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Notification not found.",
    });
  }

  notification.is_read = true;
  addUserActivity(req.user.id, `Read notification: ${notification.title}`);

  res.json({ success: true, data: notification });
});

module.exports = router;
