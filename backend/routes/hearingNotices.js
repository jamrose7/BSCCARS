const express = require("express");
const db = require("../db");
const {
  addUserActivity,
  addAdminNotification,
  addUserNotification,
} = require("../data/dbActivity");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_OUTCOMES = [
  "pending",
  "respondent_appeared",
  "respondent_absent",
  "settled",
  "escalated",
];

const ALLOWED_STAGES = [
  "first_mediation",
  "second_mediation",
  "conciliation",
  "cfa_issued",
];

const ALLOWED_NOTICE_SERVED_METHODS = ["printed", "in_person"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableDateTime(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  return raw.replace("T", " ").slice(0, 19);
}

function normalizeNullableHearingDate(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? raw
    : "";
}

function normalizeNullableHearingTime(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  const match = raw.match(/^(?:([01]\d|2[0-3]):([0-5]\d))(?:\:([0-5]\d))?$/);
  if (!match) return "";

  const [, hour, minute, second = "00"] = match;
  return `${hour}:${minute}:${second}`;
}

async function getNoticeById(id) {
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
    [id],
  );
  return rows[0] || null;
}

async function notifyComplainant(complaintId, title, message) {
  const [rows] = await db.query(
    "SELECT submitter_id FROM complaints WHERE id = ? LIMIT 1",
    [complaintId],
  );
  if (rows[0]?.submitter_id) {
    await addUserNotification(rows[0].submitter_id, title, message);
  }
}

function validateNoticePayload({
  stage,
  outcome,
  hearingDate,
  hearingTime,
  noticeServedMethod,
  noticeServedAt,
}) {
  if (!ALLOWED_STAGES.includes(stage)) {
    return "Invalid stage. Use first_mediation, second_mediation, conciliation, or cfa_issued.";
  }
  if (!ALLOWED_OUTCOMES.includes(outcome)) {
    return "Invalid outcome. Use pending, respondent_appeared, respondent_absent, settled, or escalated.";
  }
  if (
    noticeServedMethod &&
    !ALLOWED_NOTICE_SERVED_METHODS.includes(noticeServedMethod)
  ) {
    return "Invalid notice served method. Use printed or in_person.";
  }
  if (noticeServedAt === "") {
    return "Notice served date/time is invalid.";
  }
  if (hearingDate === "") {
    return "Hearing date must use YYYY-MM-DD.";
  }
  if (hearingTime === "") {
    return "Hearing time must use HH:mm.";
  }
  if (stage !== "cfa_issued" && Boolean(hearingDate) !== Boolean(hearingTime)) {
    return "A hearing date and time must be provided together.";
  }
  return "";
}

router.post(
  "/",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const complaintId = cleanString(req.body?.complaint_id);
    const stage = cleanString(req.body?.stage) || "first_mediation";
    const outcome = cleanString(req.body?.outcome) || "pending";
    const hearingDate = normalizeNullableHearingDate(req.body?.hearing_date);
    const hearingTime = normalizeNullableHearingTime(req.body?.hearing_time);
    const noticeServedMethod = cleanString(req.body?.notice_served_method);
    const noticeServedAt = normalizeNullableDateTime(req.body?.notice_served_at);

    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: "Complaint ID is required.",
      });
    }

    const validationError = validateNoticePayload({
      stage,
      outcome,
      hearingDate,
      hearingTime,
      noticeServedMethod,
      noticeServedAt,
    });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

        const [complaints] = await db.query(
      "SELECT id, category_base FROM complaints WHERE id = ? LIMIT 1",
      [complaintId],
    );
    if (!complaints.length) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }
    if (complaints[0].category_base !== "Money Debt") {
      return res.status(400).json({
        success: false,
        message: "Hearing notices are only available for Money Debt complaints.",
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO hearing_notices (
          complaint_id, generated_by, stage, outcome, hearing_date,
          hearing_time, notice_served_method, notice_served_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        complaintId,
        req.user.id,
        stage,
        outcome,
        hearingDate,
        hearingTime,
        noticeServedMethod || null,
        noticeServedAt,
      ],
    );

    const createdNotice = await getNoticeById(result.insertId);
    await addUserActivity(req.user.id, `Created hearing notice (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(createdNotice.id),
      details: `Stage: ${stage}`,
    });
    await addAdminNotification({
      title: "Hearing notice created",
      message: `${req.user.first_name || "An admin"} created a ${stage.replace(/_/g, " ")} hearing notice for ${complaintId}.`,
    });

    const scheduleInfo = hearingDate
      ? ` Scheduled on ${hearingDate}${hearingTime ? " at " + hearingTime.slice(0, 5) : ""}.`
      : "";
    await notifyComplainant(
      complaintId,
      "Hearing notice created",
      `A hearing notice (${stage.replace(/_/g, " ")}) has been created for your complaint (${complaintId}).${scheduleInfo} The printed KP Form with full details will be delivered to you.`,
    );

    return res.status(201).json({
      success: true,
      message: "Hearing notice created.",
      data: createdNotice,
    });
  },
);

router.patch(
  "/:noticeId/outcome",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const noticeId = Number(req.params.noticeId) || req.params.noticeId;
    const stage = cleanString(req.body?.stage) || "first_mediation";
    const outcome = cleanString(req.body?.outcome);
    const hearingDate = normalizeNullableHearingDate(req.body?.hearing_date);
    const hearingTime = normalizeNullableHearingTime(req.body?.hearing_time);
    const noticeServedMethod = cleanString(req.body?.notice_served_method);
    const noticeServedAt = normalizeNullableDateTime(req.body?.notice_served_at);

    const validationError = validateNoticePayload({
      stage,
      outcome,
      hearingDate,
      hearingTime,
      noticeServedMethod,
      noticeServedAt,
    });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const existingNotice = await getNoticeById(noticeId);
    if (!existingNotice) {
      return res.status(404).json({
        success: false,
        message: "Hearing notice not found.",
      });
    }

    const [complaintRows] = await db.query(
      "SELECT category_base FROM complaints WHERE id = ? LIMIT 1",
      [existingNotice.complaint_id],
    );
    if (complaintRows[0]?.category_base !== "Money Debt") {
      return res.status(400).json({
        success: false,
        message: "Hearing notices are only available for Money Debt complaints.",
      });
    }

    const [result] = await db.query(
      `
        UPDATE hearing_notices
        SET stage = ?,
            outcome = ?,
            hearing_date = ?,
            hearing_time = ?,
            notice_served_method = ?,
            notice_served_at = ?
        WHERE id = ?
      `,
      [
        stage,
        outcome,
        hearingDate,
        hearingTime,
        noticeServedMethod || null,
        noticeServedAt,
        noticeId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Hearing notice not found.",
      });
    }

    const updatedNotice = await getNoticeById(noticeId);
    await addUserActivity(req.user.id, `Updated hearing notice outcome (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(noticeId),
      details: `Outcome: ${outcome}; served method: ${noticeServedMethod || "not recorded"}`,
    });
    await addAdminNotification({
      title: "Hearing notice updated",
      message: `${updatedNotice.complaint_id} hearing notice outcome set to ${outcome.replace(/_/g, " ")}.`,
    });

    const scheduleInfo = updatedNotice.hearing_date
      ? ` Hearing scheduled on ${updatedNotice.hearing_date}${updatedNotice.hearing_time ? " at " + String(updatedNotice.hearing_time).slice(0, 5) : ""}.`
      : "";
    await notifyComplainant(
      updatedNotice.complaint_id,
      "Hearing notice updated",
      `The hearing notice for your complaint (${updatedNotice.complaint_id}) has been updated.${scheduleInfo} Current outcome: ${outcome.replace(/_/g, " ")}.`,
    );

    return res.json({
      success: true,
      message: "Hearing notice outcome updated.",
      data: updatedNotice,
    });
  },
);

module.exports = router;
