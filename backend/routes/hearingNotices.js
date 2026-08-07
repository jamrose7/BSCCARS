const express = require("express");
const db = require("../db");
const {
  addUserActivity,
  addAdminNotification,
  addUserNotification,
  complaints,
} = require("../data/mockData");
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

const ALLOWED_NOTICE_SERVED_METHODS = ["printed", "in_person"];

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
    const complaintId = cleanString(req.body?.complaint_id);
    const stage = cleanString(req.body?.stage) || "first_mediation";
    const outcome = cleanString(req.body?.outcome) || "pending";
    const hearingDate = cleanString(req.body?.hearing_date) || null;
    const hearingTime = cleanString(req.body?.hearing_time) || null;
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
          "Invalid notice served method. Use printed or in_person.",
      });
    }

    if (noticeServedAt === "") {
      return res.status(400).json({
        success: false,
        message: "Notice served date/time is invalid.",
      });
    }

    let createdNotice;

    if (shouldUseDatabase()) {
      const [result] = await db.query(
        `
          INSERT INTO hearing_notices (
            complaint_id,
            generated_by,
            stage,
            outcome,
            hearing_date,
            hearing_time,
            notice_served_method,
            notice_served_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          complaintId,
          req.user?.id || "ADMIN01",
          stage,
          outcome,
          hearingDate,
          hearingTime,
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
      createdNotice = rows[0];
    } else {
      // In-memory fallback (mock data mode)
      const complaint = complaints.find((c) => c.id === complaintId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found.",
        });
      }

      const now = new Date().toISOString();
      const notice = {
        id: Date.now(),
        complaint_id: complaintId,
        generated_by: req.user?.id || "ADMIN01",
        hearing_date: hearingDate,
        hearing_time: hearingTime,
        stage,
        outcome,
        notice_served_method: noticeServedMethod || null,
        notice_served_at: noticeServedAt,
        location: null,
        mediation_notes: null,
        created_at: now,
      };

      complaint.hearingNotices = complaint.hearingNotices || [];
      complaint.hearingNotices.push(notice);
      createdNotice = notice;
    }

    addUserActivity(req.user?.id, `Created hearing notice (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(createdNotice.id),
      details: `Stage: ${stage}`,
    });

    addAdminNotification({
      title: "Hearing notice created",
      message: `${req.user?.first_name || "An admin"} created a ${stage.replace(/_/g, " ")} hearing notice for ${complaintId}.`,
    });

    // Notify the complainant that a hearing notice was created
    try {
      const targetComplaint = shouldUseDatabase()
        ? (await db.query("SELECT submitter_id FROM complaints WHERE id = ? LIMIT 1", [complaintId]))[0][0]
        : complaints.find((c) => c.id === complaintId);
      const submitterId = shouldUseDatabase()
        ? targetComplaint?.submitter_id
        : targetComplaint?.submitterId;
      if (submitterId) {
        const scheduleInfo =
          hearingDate
            ? ` Scheduled on ${hearingDate}${hearingTime ? " at " + hearingTime.slice(0, 5) : ""}.`
            : "";
        addUserNotification(
          submitterId,
          "Hearing notice created",
          `A hearing notice (${stage.replace(/_/g, " ")}) has been created for your complaint (${complaintId}).${scheduleInfo} The printed KP Form with full details will be delivered to you.`,
        );
      }
    } catch (_) {
      // Notification is best-effort; do not block the response
    }

    res.status(201).json({
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
    const hearingDate = cleanString(req.body?.hearing_date) || null;
    const hearingTime = cleanString(req.body?.hearing_time) || null;
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
          "Invalid notice served method. Use printed or in_person.",
      });
    }

    if (noticeServedAt === "") {
      return res.status(400).json({
        success: false,
        message: "Notice served date/time is invalid.",
      });
    }

    let updatedNotice;

    if (shouldUseDatabase()) {
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
        [stage, outcome, hearingDate, hearingTime, noticeServedMethod || null, noticeServedAt, noticeId],
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
      updatedNotice = rows[0];
    } else {
      // In-memory fallback (mock data mode)
      let found = null;
      let foundComplaint = null;
      for (const c of complaints) {
        const notices = c.hearingNotices || [];
        const idx = notices.findIndex((n) => String(n.id) === String(noticeId));
        if (idx !== -1) {
          found = notices[idx];
          foundComplaint = c;
          // Update in-place
          notices[idx] = {
            ...found,
            stage,
            outcome,
            hearing_date: hearingDate,
            hearing_time: hearingTime,
            notice_served_method: noticeServedMethod || null,
            notice_served_at: noticeServedAt,
          };
          found = notices[idx];
          break;
        }
      }

      if (!found) {
        return res.status(404).json({
          success: false,
          message: "Hearing notice not found.",
        });
      }
      updatedNotice = found;
    }

    addUserActivity(req.user?.id, `Updated hearing notice outcome (${stage})`, {
      targetType: "hearing_notice",
      targetId: String(noticeId),
      details: `Outcome: ${outcome}; served method: ${noticeServedMethod || "not recorded"}`,
    });

    addAdminNotification({
      title: "Hearing notice updated",
      message: `${updatedNotice.complaint_id} hearing notice outcome set to ${outcome.replace(/_/g, " ")}.`,
    });

    // Notify the complainant that the hearing notice was updated
    try {
      const targetComplaint = shouldUseDatabase()
        ? (await db.query("SELECT submitter_id FROM complaints WHERE id = ? LIMIT 1", [updatedNotice.complaint_id]))[0][0]
        : complaints.find((c) => c.id === updatedNotice.complaint_id);
      const submitterId = shouldUseDatabase()
        ? targetComplaint?.submitter_id
        : targetComplaint?.submitterId;
      if (submitterId) {
        const scheduleInfo =
          updatedNotice.hearing_date
            ? ` Hearing scheduled on ${updatedNotice.hearing_date}${updatedNotice.hearing_time ? " at " + String(updatedNotice.hearing_time).slice(0, 5) : ""}.`
            : "";
        addUserNotification(
          submitterId,
          "Hearing notice updated",
          `The hearing notice for your complaint (${updatedNotice.complaint_id}) has been updated.${scheduleInfo} Current outcome: ${outcome.replace(/_/g, " ")}.`,
        );
      }
    } catch (_) {
      // Notification is best-effort; do not block the response
    }

    res.json({
      success: true,
      message: "Hearing notice outcome updated.",
      data: updatedNotice,
    });
  },
);

module.exports = router;
