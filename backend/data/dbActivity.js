const crypto = require("crypto");
const db = require("../db");

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomInt(100000, 999999)}`;
}

function fullName(user) {
  if (!user) return "User";
  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || user.email || user.id || "User";
}

async function addUserActivity(userId, action, meta = {}) {
  await db.query(
    `
      INSERT INTO activity_logs (id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      makeId("activity"),
      userId || null,
      action,
      meta.targetType || null,
      meta.targetId || meta.complaint_id || meta.resident_id || null,
      meta.details || (meta.category ? JSON.stringify(meta) : null),
    ],
  );
}

async function addActivityLog({
  userId = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
}) {
  return addUserActivity(userId, action, { targetType, targetId, details });
}

async function addUserNotification(userId, title, message) {
  if (!userId) return;
  await db.query(
    `
      INSERT INTO notifications (id, user_id, title, message)
      VALUES (?, ?, ?, ?)
    `,
    [makeId("notification"), userId, title, message],
  );
}

async function addAdminNotification({ title, message }) {
  const [admins] = await db.query(
    `
      SELECT id
      FROM users
      WHERE role IN ('assistant_admin', 'super_admin')
        AND account_status = 'active'
        AND is_archived = FALSE
    `,
  );

  await Promise.all(
    admins.map((admin) => addUserNotification(admin.id, title, message)),
  );
}

module.exports = {
  addUserActivity,
  addActivityLog,
  addUserNotification,
  addAdminNotification,
  fullName,
};
