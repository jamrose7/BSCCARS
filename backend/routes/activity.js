const express = require("express");
const db = require("../db");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

// System-wide activity oversight is reserved for the Super Admin.
router.use(requireRoles("super_admin"));

router.get("/", async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page || "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(req.query.pageSize || "20", 10) || 20, 1),
    100,
  );
  const search = String(req.query.search || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const activity = String(req.query.activity || "").trim();
  const sort = String(req.query.sort || "latest").toLowerCase() === "oldest" ? "ASC" : "DESC";
  const where = [];
  const params = [];

  if (search) {
    where.push(`
      (
        l.action LIKE ?
        OR l.details LIKE ?
        OR l.target_type LIKE ?
        OR l.target_id LIKE ?
        OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ?
      )
    `);
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }
  if (from) {
    where.push("l.created_at >= ?");
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push("l.created_at <= ?");
    params.push(`${to} 23:59:59`);
  }
  if (activity) {
    where.push("l.action = ?");
    params.push(activity);
  }
  where.push(`
    NOT (
      l.target_type = 'complaint'
      AND l.target_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM complaints c
        WHERE c.id = l.target_id
      )
    )
  `);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  const countParams = [...params];
  const [countRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereSql}
    `,
    countParams,
  );
  const [rows] = await db.query(
    `
      SELECT
        l.id,
        l.user_id AS userId,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''),
          CASE
            WHEN l.action = 'Resident registration submitted'
              AND l.target_type = 'resident'
            THEN NULLIF(TRIM(CONCAT_WS(' ', target_user.first_name, target_user.middle_name, target_user.last_name)), '')
            ELSE NULL
          END,
          'System'
        ) AS user,
        l.action,
        COALESCE(
          l.target_type,
          CASE WHEN l.action LIKE 'Read notification: %' THEN 'notification' ELSE NULL END
        ) AS targetType,
        COALESCE(
          l.target_id,
          CASE
            WHEN l.action LIKE 'Read notification: %' THEN (
              SELECT n.id
              FROM notifications n
              WHERE n.user_id = l.user_id
                AND n.title = SUBSTRING(l.action, LENGTH('Read notification: ') + 1)
                AND n.read_at IS NOT NULL
                AND ABS(TIMESTAMPDIFF(SECOND, n.read_at, l.created_at)) <= 120
              ORDER BY ABS(TIMESTAMPDIFF(SECOND, n.read_at, l.created_at)) ASC, n.id ASC
              LIMIT 1
            )
            ELSE NULL
          END
        ) AS targetId,
        l.details,
        l.created_at AS timestamp
      FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN users target_user
        ON l.action = 'Resident registration submitted'
        AND l.target_type = 'resident'
        AND target_user.id = l.target_id
      ${whereSql}
      ORDER BY l.created_at ${sort}
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  );
  const [activityRows] = await db.query(
    "SELECT DISTINCT action FROM activity_logs ORDER BY action ASC",
  );
  return res.json({
    success: true,
    data: rows,
    pagination: {
      page,
      pageSize,
      total: Number(countRows[0]?.total || 0),
      totalPages: Math.max(Math.ceil(Number(countRows[0]?.total || 0) / pageSize), 1),
    },
    activities: activityRows.map((row) => row.action),
  });
});

module.exports = router;
