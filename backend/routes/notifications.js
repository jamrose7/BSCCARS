const express = require("express");
const router = express.Router();
const db = require("../db");
const { addUserActivity } = require("../data/dbActivity");

function notificationRowToApi(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    read_at: row.read_at,
  };
}

// GET /api/notifications
router.get("/", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT id, title, message, is_read, created_at, read_at
      FROM notifications
      WHERE user_id = ?
        AND NOT (
          title = 'New complaint submitted'
          AND message REGEXP 'CMP-2026-[0-9]{4}'
          AND NOT EXISTS (
            SELECT 1
            FROM complaints c
            WHERE message LIKE CONCAT('%', c.id, '%')
          )
        )
      ORDER BY created_at DESC
    `,
    [req.user.id],
  );
  return res.json({ success: true, data: rows.map(notificationRowToApi) });
});

// GET /api/notifications/unread
router.get("/unread", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT id, title, message, is_read, created_at, read_at
      FROM notifications
      WHERE user_id = ?
        AND is_read = FALSE
        AND NOT (
          title = 'New complaint submitted'
          AND message REGEXP 'CMP-2026-[0-9]{4}'
          AND NOT EXISTS (
            SELECT 1
            FROM complaints c
            WHERE message LIKE CONCAT('%', c.id, '%')
          )
        )
      ORDER BY created_at DESC
    `,
    [req.user.id],
  );
  return res.json({ success: true, data: rows.map(notificationRowToApi) });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT id, title, message, is_read, created_at, read_at
      FROM notifications
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [req.params.id, req.user.id],
  );

  if (!rows.length) {
    return res.status(404).json({
      success: false,
      message: "Notification not found.",
    });
  }

  await db.query(
    `
      UPDATE notifications
      SET is_read = TRUE,
          read_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
    `,
    [req.params.id, req.user.id],
  );

  await addUserActivity(req.user.id, `Read notification: ${rows[0].title}`, {
    targetType: "notification",
    targetId: rows[0].id,
  });

  return res.json({
    success: true,
    data: notificationRowToApi({
      ...rows[0],
      is_read: true,
      read_at: new Date(),
    }),
  });
});

module.exports = router;
