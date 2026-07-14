const express = require("express");
const db = require("../db");
const { addUserActivity } = require("../data/mockData");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_OUTCOMES = [
  "pending",
  "respondent_appeared",
  "respondent_absent",
  "settled",
  "escalated",
  "unresolved",
];

const ALLOWED_NOTICE_SERVED_METHODS = ["printed", "email", "in_person"];

function shouldUseDatabase() {
  return Boolean(
    process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME,
  );
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableDateTime(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return raw.replace("T", " ").slice(0, 19);
}

router.post(
  "/",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    if (!shouldUseDatabase()) {
      return res.status(503).json({
        success: false,
        message: "Hearing notice creation requires MySQL configuration.",
      });
    }

    const complaintId = cleanString(req.body?.complaint_id);
    const stage = cleanString(req.body?.stage) || "first_mediation";
    const outcome = cleanString(req.body?.outcome) || "pending";
    const noticeServedMethod = cleanString(req.body?.notice_served_method);
    const noticeServedAt = normalizeNullableDateTime(
      req.body?.notice_served_at,
    );

    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: "Complaint ID is required.",
      });
    }

    if (!ALLOWED_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid outcome. Use pending, respondent_appeared, respondent_absent, settled, or escalated.",
      });
    }

    if (
      noticeServedMethod &&
      !ALLOWED_NOTICE_SERVED_METHODS.includes(noticeServedMethod)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid notice served method. Use printed, email, or in_person.",
      });
    }

    if (noticeServedAt === "") {
      return res.status(400).json({
        success: false,
        message: "Notice served date/time is invalid.",
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO hearing_notices (
          complaint_id,
          generated_by,
          stage,
          outcome,
          notice_served_method,
          notice_served_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        complaintId,
        req.user?.id || "ADMIN01",
        stage,
        outcome,
        noticeServedMethod || null,
        noticeServedAt,
      ],
    );

    const [rows] = await db.query(
      `
        SELECT
          id,
          complaint_id,
          generated_by,
          hearing_date,
          hearing_time,
          stage,
          outcome,
          notice_served_method,
          notice_served_at,
          location,
          mediation_notes,
          created_at
        FROM hearing_notices
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId],
    );

    addUserActivity(req.user?.id, `Created hearing notice (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(result.insertId),
      details: `Stage: ${stage}`,
    });

    res.status(201).json({
      success: true,
      message: "Hearing notice created.",
      data: rows[0],
    });
  },
);

router.patch(
  "/:noticeId/outcome",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    if (!shouldUseDatabase()) {
      return res.status(503).json({
        success: false,
        message: "Hearing notice outcome updates require MySQL configuration.",
      });
    }

    const noticeId = req.params.noticeId;
    const stage = cleanString(req.body?.stage) || "first_mediation";
    const outcome = cleanString(req.body?.outcome);
    const noticeServedMethod = cleanString(req.body?.notice_served_method);
    const noticeServedAt = normalizeNullableDateTime(
      req.body?.notice_served_at,
    );

    if (!ALLOWED_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid outcome. Use pending, respondent_appeared, respondent_absent, settled, or escalated.",
      });
    }

    if (
      noticeServedMethod &&
      !ALLOWED_NOTICE_SERVED_METHODS.includes(noticeServedMethod)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid notice served method. Use printed, email, or in_person.",
      });
    }

    if (noticeServedAt === "") {
      return res.status(400).json({
        success: false,
        message: "Notice served date/time is invalid.",
      });
    }

    const [result] = await db.query(
      `
        UPDATE hearing_notices
        SET stage = ?,
            outcome = ?,
            notice_served_method = ?,
            notice_served_at = ?
        WHERE id = ?
      `,
      [stage, outcome, noticeServedMethod || null, noticeServedAt, noticeId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Hearing notice not found.",
      });
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          complaint_id,
          generated_by,
          hearing_date,
          hearing_time,
          stage,
          outcome,
          notice_served_method,
          notice_served_at,
          location,
          mediation_notes,
          created_at
        FROM hearing_notices
        WHERE id = ?
        LIMIT 1
      `,
      [noticeId],
    );

    addUserActivity(req.user?.id, `Updated hearing notice outcome (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(noticeId),
      details: `Outcome: ${outcome}; served method: ${noticeServedMethod || "not recorded"}`,
    });

    res.json({
      success: true,
      message: "Hearing notice outcome updated.",
      data: rows[0],
    });
  },
);

router.post(
  "/:noticeId/email-copy",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const noticeId = req.params.noticeId;
    // SMS is out of scope and intentionally not implemented.
    // TODO: wire an existing email provider (for example SMTP or a transactional provider)
    // before enabling this feature.
    addUserActivity(req.user?.id, "Requested hearing notice email copy", {
      targetType: "hearing_notice",
      targetId: String(noticeId),
      details: "Best-effort email copy requested; no provider configured yet.",
    });

    return res.status(501).json({
      success: false,
      message:
        "Best-effort email delivery is not configured yet. TODO: wire an existing email provider before enabling this feature.",
    });
  },
);

module.exports = router;
