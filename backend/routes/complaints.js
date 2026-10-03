const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireRoles } = require("../middleware/auth");
const { formatIncidentTime } = require("../utils/formatters");
const { getDbUserById } = require("../data/dbUsers");
const {
  sendComplaintStatusUpdateEmail,
  sendAdminResponseEmail,
} = require("../services/emailService");
const {
  addUserActivity,
  addUserNotification,
  addAdminNotification,
  fullName,
} = require("../data/dbActivity");

const ADMIN_RESPONSE_MAX_LENGTH = 1500;
const RESIDENT_FOLLOW_UP_MAX_LENGTH = 1500;
const MAX_VIDEO_DURATION_SECONDS = 20;
const RESPONDENT_MAX = {
  name: 255,
  contactNumber: 20,
  purok: 100,
};
const CANONICAL_STATUSES = ["pending", "in-progress", "resolved"];
const LEGACY_STATUS_MAP = {
  "under review": "pending",
  under_review: "pending",
  "under-review": "pending",
  closed: "resolved",
  completed: "resolved",
};

const ALLOWED_COMPLAINT_CATEGORIES = [
  "Physical Harm, Violence, or Threats",
  "Public Health Hazard",
  "Noise and Public Disturbance",
  "Waste, Sanitation, and Environment",
  "Road and Infrastructure",
  "Property Damage",
  "Animal Concerns",
  "Money Debt",
  "Illegal or Criminal Activity",
  "Other",
];

const ALLOWED_INTAKE_SOURCES = [
  "Digital Submission",
  "In-person at Barangay Office",
  "Other",
];

const AUTO_HIGH_PRIORITY_CATEGORIES = [
  "Physical Harm, Violence, or Threats",
  "Public Health Hazard",
];

const uploadDirectory = path.join(__dirname, "..", "uploads", "complaints");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-z0-9._-]/gi, "_")
      .slice(0, 120);
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = {
      "image/jpeg": true,
      "image/png": true,
      "video/mp4": true,
    };

    if (!allowedMimeTypes[file.mimetype]) {
      const error = new Error(
        file.fieldname === "video"
          ? "Only MP4 video format is allowed."
          : "Only JPG, JPEG, and PNG image formats are allowed.",
      );
      error.code = "LIMIT_FILE_TYPES";
      return cb(error, false);
    }

    cb(null, true);
  },
});

function formatComplaintNumber(sequence) {
  return `CMP-2026-${String(sequence).padStart(4, "0")}`;
}

function validateAdminResponse(response) {
  return (
    typeof response === "string" &&
    response.trim().length > 0 &&
    response.trim().length <= ADMIN_RESPONSE_MAX_LENGTH
  );
}

function validateResidentFollowUp(updateText) {
  return (
    typeof updateText === "string" &&
    updateText.trim().length > 0 &&
    updateText.trim().length <= RESIDENT_FOLLOW_UP_MAX_LENGTH
  );
}

function dbComplaintToApi(row, attachments = [], followUps = [], statusHistory = []) {
  return {
    id: row.id,
    submitterId: row.submitter_id,
    title: row.title,
    category: row.category,
    categoryBase: row.category_base,
    categorySpecify: row.category_specify,
    details: row.details,
    respondent_name: row.respondent_name || "",
    respondent_contact_number: row.respondent_contact_number || "",
    respondent_purok: row.respondent_purok || "",
    purok: row.purok,
    incidentDate: row.incident_date ? String(row.incident_date).slice(0, 10) : "",
    incidentTime: row.incident_time
      ? formatIncidentTime(String(row.incident_time).slice(0, 5))
      : "",
    priority: row.priority,
    confidential: row.confidentiality === "Confidential" ? "Yes" : "No",
    status: normalizeStatusValue(row.status),
    source: row.source,
    sourceBase: row.source_base,
    sourceSpecify: row.source_specify,
    adminResponse: row.admin_notes || "",
    archived: Boolean(row.is_archived),
    is_archived: Boolean(row.is_archived),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    archivedAt: row.archived_at,
    attachments,
    followUps,
    statusHistory,
    complainant: {
      id: row.submitter_id,
      firstName: row.first_name || "",
      middleName: row.middle_name || "",
      lastName: row.last_name || "",
      fullName: [row.first_name, row.middle_name, row.last_name]
        .filter(Boolean)
        .join(" "),
    },
  };
}

async function getDbComplaint(id) {
  const [rows] = await db.query(
    `
      SELECT c.*, u.first_name, u.middle_name, u.last_name
      FROM complaints c
      LEFT JOIN users u ON u.id = c.submitter_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [id],
  );
  if (!rows.length) return null;

  const [attachments] = await db.query(
    `
      SELECT
        CASE
          WHEN mime_type LIKE 'video/%' OR storage_path LIKE '%.mp4' THEN 'video'
          ELSE 'image'
        END AS type,
        original_name AS originalName,
        storage_path AS path
      FROM complaint_attachments
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `,
    [id],
  );
  const [followUps] = await db.query(
    `
      SELECT id, message, created_by AS createdBy, created_at AS createdAt
      FROM complaint_follow_ups
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `,
    [id],
  );
  const [statusHistory] = await db.query(
    `
      SELECT id, previous_status AS previousStatus, new_status AS newStatus,
             changed_by AS changedBy, notes, created_at AS createdAt
      FROM complaint_status_history
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `,
    [id],
  );

  return dbComplaintToApi(rows[0], attachments, followUps, statusHistory);
}

async function getMp4DurationSeconds(filePath) {
  const file = await fs.promises.readFile(filePath);
  const readBox = (offset, limit) => {
    if (offset + 8 > limit) return null;

    let size = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > limit) return null;
      const extendedSize = file.readBigUInt64BE(offset + 8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(extendedSize);
      headerSize = 16;
    } else if (size === 0) {
      size = limit - offset;
    }

    if (size < headerSize || offset + size > limit) return null;
    return { type, start: offset, dataStart: offset + headerSize, end: offset + size };
  };

  let moov = null;
  for (let offset = 0; offset < file.length;) {
    const box = readBox(offset, file.length);
    if (!box) throw new Error("Invalid MP4 container.");
    if (box.type === "moov") {
      moov = box;
      break;
    }
    offset = box.end;
  }
  if (!moov) throw new Error("MP4 duration metadata is missing.");

  for (let offset = moov.dataStart; offset < moov.end;) {
    const box = readBox(offset, moov.end);
    if (!box) throw new Error("Invalid MP4 duration metadata.");
    if (box.type === "mvhd") {
      const version = file[box.dataStart];
      const timescaleOffset = box.dataStart + (version === 1 ? 20 : 12);
      const durationOffset = timescaleOffset + 4;
      if (version > 1 || durationOffset + (version === 1 ? 8 : 4) > box.end) {
        throw new Error("Invalid MP4 duration metadata.");
      }

      const timescale = file.readUInt32BE(timescaleOffset);
      const duration = version === 1
        ? Number(file.readBigUInt64BE(durationOffset))
        : file.readUInt32BE(durationOffset);
      const seconds = duration / timescale;
      if (!timescale || !Number.isFinite(seconds) || seconds <= 0) {
        throw new Error("Invalid MP4 duration metadata.");
      }
      return seconds;
    }
    offset = box.end;
  }

  throw new Error("MP4 duration metadata is missing.");
}

async function getNextDbComplaintId() {
  const [rows] = await db.query(
    "SELECT id FROM complaints WHERE id LIKE 'CMP-2026-%' ORDER BY id DESC LIMIT 1",
  );
  const last = rows[0]?.id || "CMP-2026-0000";
  const next = Number(String(last).slice(-4)) + 1;
  return formatComplaintNumber(next);
}

async function findRecentDuplicateComplaint({
  submitterId,
  title,
  displayCategory,
  details,
  purok,
  incidentDate,
  incidentTime,
}) {
  const [rows] = await db.query(
    `
      SELECT id
      FROM complaints
      WHERE submitter_id = ?
        AND is_archived = FALSE
        AND status IN ('pending', 'in-progress')
        AND title = ?
        AND category = ?
        AND details = ?
        AND purok = ?
        AND COALESCE(incident_date, '') = COALESCE(?, '')
        AND COALESCE(incident_time, '') = COALESCE(?, '')
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [
      submitterId,
      title,
      displayCategory,
      details,
      purok,
      incidentDate || null,
      incidentTime || null,
    ],
  );

  return rows[0]?.id || "";
}

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatOtherValue(value, specifyText) {
  return value === "Other" && specifyText ? `Other: ${specifyText}` : value;
}

function normalizeRespondentFields(body = {}) {
  return {
    respondent_name: cleanText(body.respondent_name || body.respondentName),
    respondent_contact_number: cleanText(
      body.respondent_contact_number || body.respondentContactNumber,
    ),
    respondent_purok: cleanText(body.respondent_purok || body.respondentPurok),
  };
}

function validateRespondentFields(fields) {
  if (fields.respondent_name.length > RESPONDENT_MAX.name) {
    return "Respondent full name must be 255 characters or fewer.";
  }

  if (fields.respondent_contact_number.length > RESPONDENT_MAX.contactNumber) {
    return "Respondent contact number must be 20 characters or fewer.";
  }

  if (
    fields.respondent_contact_number &&
    !/^09\d{9}$/.test(fields.respondent_contact_number)
  ) {
    return "Respondent contact number must be 11 digits and start with 09.";
  }

  if (fields.respondent_purok.length > RESPONDENT_MAX.purok) {
    return "Respondent purok must be 100 characters or fewer.";
  }

  return "";
}

function normalizeStatusValue(status) {
  const raw = String(status || "pending")
    .trim()
    .toLowerCase();
  const normalized = raw.replace(/[_\s]+/g, "-");
  return LEGACY_STATUS_MAP[raw] || LEGACY_STATUS_MAP[normalized] || normalized;
}

function normalizeConfidentiality(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  return raw === "confidential" || raw === "yes" ? "Confidential" : "Public";
}

function publicSubmitterLabel({
  confidentiality,
  firstName,
  middleName,
  lastName,
}) {
  if (normalizeConfidentiality(confidentiality) === "Confidential") {
    return "Confidential";
  }

  return (
    [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || "Public"
  );
}

function statusLabel(status) {
  return normalizeStatusValue(status)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAdminUser(user) {
  return ["assistant_admin", "super_admin"].includes(user?.role);
}

function canAccessComplaint(user, complaint) {
  return isAdminUser(user) || complaint.submitterId === user?.id;
}

// GET all complaints
router.get("/", async (req, res) => {
  const conditions = [];
  const params = [];
  const requestedStatus = req.query.status
    ? normalizeStatusValue(req.query.status)
    : "";
  const requestedPriority = String(req.query.priority || "")
    .trim()
    .toLowerCase();
  const requestedSubmitter =
    req.user.role === "resident"
      ? req.user.id
      : String(req.query.submitterId || "").trim();

  conditions.push(
    req.query.archived === "true" ? "c.is_archived = TRUE" : "c.is_archived = FALSE",
  );
  if (requestedStatus) {
    conditions.push("c.status = ?");
    params.push(requestedStatus);
  }
  if (requestedPriority) {
    conditions.push("LOWER(c.priority) = ?");
    params.push(requestedPriority);
  }
  if (requestedSubmitter) {
    conditions.push("c.submitter_id = ?");
    params.push(requestedSubmitter);
  }

  const [rows] = await db.query(
    `
      SELECT c.*, u.first_name, u.middle_name, u.last_name
      FROM complaints c
      LEFT JOIN users u ON u.id = c.submitter_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.created_at DESC
    `,
    params,
  );
  return res.json({
    success: true,
    data: rows.map((row) => dbComplaintToApi(row)),
  });
});

router.get("/check-eligibility", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS open
      FROM complaints
      WHERE submitter_id = ?
        AND is_archived = FALSE
        AND status IN ('pending', 'in-progress')
    `,
    [req.user.id],
  );
  const open = Number(rows[0]?.open || 0);
  return res.json({
    success: true,
    data:
      open >= 5
        ? {
            eligible: false,
            reason:
              "You already have 5 active complaints. Please wait for one to be resolved before submitting a new one.",
            open,
          }
        : { eligible: true, open },
  });
});

router.get("/public-feed", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT c.id, c.title, c.category, c.purok, c.incident_date,
             c.incident_time, c.status, c.confidentiality,
             u.first_name, u.middle_name, u.last_name
      FROM complaints c
      LEFT JOIN users u ON u.id = c.submitter_id
      WHERE c.is_archived = FALSE
      ORDER BY c.created_at DESC
    `,
  );
  return res.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      title: row.title || "Untitled complaint",
      category: row.category || "Uncategorized",
      purok: row.purok || "",
      date: row.incident_date ? String(row.incident_date).slice(0, 10) : "",
      time: formatIncidentTime(row.incident_time),
      status: statusLabel(row.status),
      submittedBy: publicSubmitterLabel({
        confidentiality: row.confidentiality,
        firstName: row.first_name,
        middleName: row.middle_name,
        lastName: row.last_name,
      }),
    })),
  });
});

router.get("/:id/hearing-notices", async (req, res) => {
  const [complaintRows] = await db.query(
    "SELECT id, submitter_id FROM complaints WHERE id = ? LIMIT 1",
    [req.params.id],
  );

  const complaint = complaintRows[0];
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }

  if (!isAdminUser(req.user) && complaint.submitter_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
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
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `,
    [req.params.id],
  );

  return res.json({ success: true, data: rows });
});

// GET complaint by ID
router.get("/:id", async (req, res) => {
  const complaint = await getDbComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }
  if (!canAccessComplaint(req.user, { submitterId: complaint.submitterId })) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
    });
  }
  return res.json({ success: true, data: complaint });
});

// CREATE complaint
router.post(
  "/",
  requireRoles("resident"),
  (req, res, next) => {
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_TYPES") {
          return res.status(400).json({ success: false, message: err.message });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File must not exceed 10MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "File upload failed.",
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    let cleanupUploadedFiles = () => {};

    try {
    const user = await getDbUserById(req.user.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found." });
    }

    const [eligibilityRows] = await db.query(
      `
        SELECT COUNT(*) AS open
        FROM complaints
        WHERE submitter_id = ?
          AND is_archived = FALSE
          AND status IN ('pending', 'in-progress')
      `,
      [user.id],
    );
    const openComplaints = Number(eligibilityRows[0]?.open || 0);
    if (openComplaints >= 5) {
      await addAdminNotification({
        title: "Resident reached active complaint limit",
        message: `${fullName(user)} (${user.id}) has reached the 5 active complaint limit and attempted to submit another. Please review their pending complaints.`,
      });
      return res.status(403).json({
        success: false,
        message:
          "You already have 5 active complaints. Please wait for one to be resolved before submitting a new one.",
        data: { openComplaints },
      });
    }

    const complaintData = req.body;
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    cleanupUploadedFiles = () => {
      if (imageFile) fs.unlink(imageFile.path, () => {});
      if (videoFile) fs.unlink(videoFile.path, () => {});
    };

    if (videoFile) {
      let videoDuration;
      try {
        videoDuration = await getMp4DurationSeconds(videoFile.path);
      } catch (error) {
        cleanupUploadedFiles();
        return res.status(400).json({
          success: false,
          message: "Unable to validate MP4 video duration. Please upload a valid MP4 video.",
        });
      }

      if (videoDuration > MAX_VIDEO_DURATION_SECONDS) {
        cleanupUploadedFiles();
        return res.status(400).json({
          success: false,
          message: "Video must not exceed 20 seconds.",
        });
      }
    }

    const title = cleanText(complaintData.title);
    const details = cleanText(complaintData.details);
    const purok = cleanText(complaintData.purok);

    if (!title || !details || !purok) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Complaint title, details, and purok are required.",
      });
    }
    if (title.length > 120) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Complaint title must be 120 characters or fewer.",
      });
    }
    if (details.length > 2000) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Complaint details must be 2000 characters or fewer.",
      });
    }
    if (!complaintData.incidentDate) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Incident date is required.",
      });
    }

    const category = cleanText(complaintData.category);
    if (!ALLOWED_COMPLAINT_CATEGORIES.includes(category)) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Invalid complaint category. Please select a valid category.",
      });
    }

    const categorySpecify = cleanText(
      complaintData.categorySpecify || complaintData.category_specify,
    );
    if (category === "Other" && !categorySpecify) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Please specify the Other complaint category.",
      });
    }
    if (categorySpecify.length > 100) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Other complaint category must be 100 characters or fewer.",
      });
    }

    const displayCategory = formatOtherValue(category, categorySpecify);
    const respondentFields = normalizeRespondentFields(complaintData);

    // Respondent identity fields are only permitted for Money Debt complaints.
    // Stripped here server-side regardless of what the client sends, since a
    // direct API call could bypass the frontend's category-based toggle.
    if (category !== "Money Debt") {
      respondentFields.respondent_name = "";
      respondentFields.respondent_contact_number = "";
      respondentFields.respondent_purok = "";
    }

    if (category === "Money Debt" && !respondentFields.respondent_name) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Respondent full name is required for Money Debt complaints.",
      });
    }

    if (category === "Money Debt" && !respondentFields.respondent_purok) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Respondent purok is required for Money Debt complaints.",
      });
    }

    const respondentError = validateRespondentFields(respondentFields);
    if (respondentError) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: respondentError,
      });
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      cleanupUploadedFiles();
      return res.status(400).json({
        success: false,
        message: "Image must not exceed 5MB.",
      });
    }

    const attachments = [];
    if (imageFile) {
      attachments.push({
        type: "image",
        originalName: imageFile.originalname,
        path: `/api/uploads/complaints/${imageFile.filename}`,
        mimeType: imageFile.mimetype,
        fileSize: imageFile.size,
      });
    }

    if (videoFile) {
      attachments.push({
        type: "video",
        originalName: videoFile.originalname,
        path: `/api/uploads/complaints/${videoFile.filename}`,
        mimeType: videoFile.mimetype,
        fileSize: videoFile.size,
      });
    }

    const isAutoHighPriority = AUTO_HIGH_PRIORITY_CATEGORIES.includes(category);
    const normalizedPriority = String(complaintData.priority || "Normal")
      .trim()
      .toLowerCase();
    const requestedHighPriority = normalizedPriority === "high";
    const finalPriority = isAutoHighPriority ? "High" : "Normal";

    if (requestedHighPriority && !isAutoHighPriority) {
      await addUserActivity(user.id, "High priority override", {
        complaint_title: title,
        category,
        requested_priority: "High",
        applied_priority: "Normal",
      });
    }

    const duplicateComplaintId = await findRecentDuplicateComplaint({
      submitterId: user.id,
      title,
      displayCategory,
      details,
      purok,
      incidentDate: complaintData.incidentDate,
      incidentTime: complaintData.incidentTime,
    });
    if (duplicateComplaintId) {
      cleanupUploadedFiles();
      return res.status(200).json({
        success: true,
        message: "This complaint was already submitted.",
        data: await getDbComplaint(duplicateComplaintId),
      });
    }

    const complaintId = await getNextDbComplaintId();
    const confidentiality = normalizeConfidentiality(
      complaintData.confidentiality || complaintData.confidential,
    );

    await db.query(
      `
        INSERT INTO complaints (
          id, submitter_id, title, category, category_base, category_specify,
          details, respondent_name, respondent_contact_number,
          respondent_purok, purok, incident_date, incident_time, priority,
          confidentiality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        complaintId,
        user.id,
        title,
        displayCategory,
        category,
        category === "Other" ? categorySpecify : "",
        details,
        respondentFields.respondent_name,
        respondentFields.respondent_contact_number,
        respondentFields.respondent_purok,
        purok,
        complaintData.incidentDate,
        complaintData.incidentTime || null,
        finalPriority,
        confidentiality,
      ],
    );

    for (const attachment of attachments) {
      const columns = ["complaint_id", "original_name", "storage_path", "mime_type", "file_size"];
      const values = [
        complaintId,
        attachment.originalName,
        attachment.path,
        attachment.mimeType || (attachment.type === "video" ? "video/mp4" : "image/jpeg"),
        attachment.fileSize || 0,
      ];

      await db.query(
        `
          INSERT INTO complaint_attachments (${columns.join(", ")})
          VALUES (${columns.map(() => "?").join(", ")})
        `,
        values,
      );
    }

    await db.query(
      `
        INSERT INTO complaint_status_history (
          complaint_id, changed_by, previous_status, new_status, notes
        ) VALUES (?, ?, NULL, 'pending', '')
      `,
      [complaintId, user.id],
    );

    await addUserActivity(user.id, "Submitted complaint", {
      targetType: "complaint",
      targetId: complaintId,
      complaint_id: complaintId,
      details: title,
    });

    if (isAutoHighPriority) {
      await addUserActivity(user.id, "Auto-priority assignment", {
        targetType: "complaint",
        targetId: complaintId,
        complaint_id: complaintId,
        details: `Category ${displayCategory} forced priority High`,
      });
      await addAdminNotification({
        title: "URGENT: A High Priority complaint has been submitted",
        message: `URGENT: A High Priority complaint has been submitted under ${displayCategory}. Immediate review is required.`,
      });
    }

    await addAdminNotification({
      title: "New complaint submitted",
      message: `${fullName(user)} submitted ${complaintId}: ${title}.`,
    });

    const savedComplaint = await getDbComplaint(complaintId);
    return res.status(201).json({
      success: true,
      data: savedComplaint,
    });
    } catch (error) {
      cleanupUploadedFiles();
      return next(error);
    }
  },
);

// -----------------------------
// UPDATE complaint status
// -----------------------------
router.patch(
  "/:id/status",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const normalizedStatus = normalizeStatusValue(status);

    if (!CANONICAL_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use Pending, In Progress, or Resolved.",
      });
    }

    const normalizedNotes = typeof notes === "string" ? notes.trim() : "";

    if (
      ["in-progress", "resolved"].includes(normalizedStatus) &&
      !validateAdminResponse(normalizedNotes)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "An official admin response is required before moving a complaint to In Progress or Resolved.",
      });
    }

    if (normalizedNotes && !validateAdminResponse(normalizedNotes)) {
      return res.status(400).json({
        success: false,
        message: `Admin response must not exceed ${ADMIN_RESPONSE_MAX_LENGTH} characters.`,
      });
    }

    let sourceUpdate = null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "source")) {
      const source = cleanText(req.body.source);
      if (!ALLOWED_INTAKE_SOURCES.includes(source)) {
        return res.status(400).json({
          success: false,
          message: "Invalid complaint intake source.",
        });
      }

      const sourceSpecify = cleanText(
        req.body.sourceSpecify || req.body.source_specify,
      );
      if (source === "Other" && !sourceSpecify) {
        return res.status(400).json({
          success: false,
          message: "Please specify the Other intake source.",
        });
      }
      if (sourceSpecify.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Other intake source must be 100 characters or fewer.",
        });
      }

      sourceUpdate = {
        source: formatOtherValue(source, sourceSpecify),
        sourceBase: source,
        sourceSpecify: source === "Other" ? sourceSpecify : "",
      };
    }

    const complaint = await getDbComplaint(id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }
    const previousStatus = normalizeStatusValue(complaint.status);
    await db.query(
      `
        UPDATE complaints
        SET status = ?, admin_notes = COALESCE(?, admin_notes),
            source = COALESCE(?, source),
            source_base = COALESCE(?, source_base),
            source_specify = COALESCE(?, source_specify),
            resolved_at = CASE WHEN ? = 'resolved' AND resolved_at IS NULL THEN CURRENT_TIMESTAMP ELSE resolved_at END
        WHERE id = ?
      `,
      [
        normalizedStatus,
        normalizedNotes || null,
        sourceUpdate?.source || null,
        sourceUpdate?.sourceBase || null,
        sourceUpdate?.sourceSpecify || null,
        normalizedStatus,
        id,
      ],
    );
    await db.query(
      `
        INSERT INTO complaint_status_history (
          complaint_id, changed_by, previous_status, new_status, notes
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [id, req.user.id, previousStatus, normalizedStatus, normalizedNotes || ""],
    );
    if (complaint.submitterId) {
      await addUserNotification(
        complaint.submitterId,
        `Complaint ${complaint.id} status updated`,
        `Your complaint is now ${statusLabel(normalizedStatus)}.`,
      );
      try {
        const submitter = await getDbUserById(complaint.submitterId);
        if (submitter?.email) {
          await sendComplaintStatusUpdateEmail(
            submitter,
            complaint,
            statusLabel(normalizedStatus),
          );
          if (normalizedNotes) {
            await sendAdminResponseEmail(submitter, complaint, normalizedNotes);
          }
        }
      } catch (emailError) {
        console.error("Failed to send complaint status email:", emailError);
      }
    }

    await addUserActivity(req.user.id, "Updated complaint status", {
      targetType: "complaint",
      targetId: complaint.id,
      complaint_id: complaint.id,
      details: `${statusLabel(previousStatus)} to ${statusLabel(normalizedStatus)}`,
    });

    return res.json({
      success: true,
      message: "Status updated",
      data: await getDbComplaint(id),
    });
  },
);

router.post(
  "/:id/comment",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { comment, isInternal = false } = req.body;
    const normalizedComment = typeof comment === "string" ? comment.trim() : "";

    if (!validateAdminResponse(normalizedComment)) {
      return res.status(400).json({
        success: false,
        message: `Admin response must not exceed ${ADMIN_RESPONSE_MAX_LENGTH} characters.`,
      });
    }

    const commentId = `comment-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await db.query(
      `
        INSERT INTO complaint_comments (id, complaint_id, author_id, comment, is_internal)
        VALUES (?, ?, ?, ?, ?)
      `,
      [commentId, id, req.user.id, normalizedComment, Boolean(isInternal) ? 1 : 0],
    );

    return res.status(201).json({
      success: true,
      message: "Comment added",
      data: {
        id: commentId,
        comment: normalizedComment,
        isInternal: Boolean(isInternal),
        createdAt: new Date().toISOString(),
      },
    });
  },
);

router.post("/:id/follow-up", async (req, res) => {
  const complaint = await getDbComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }
  if (req.user.role !== "resident" || complaint.submitterId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "You can only add follow-ups to complaints you submitted.",
    });
  }
  if (complaint.is_archived) {
    return res.status(400).json({
      success: false,
      message: "Archived complaints cannot receive follow-ups.",
    });
  }
  const currentStatus = normalizeStatusValue(complaint.status);
  if (!["pending", "in-progress"].includes(currentStatus)) {
    return res.status(400).json({
      success: false,
      message: "Only active complaints can receive follow-ups.",
    });
  }
  const updateText = String(req.body.update || req.body.message || "").trim();
  if (!validateResidentFollowUp(updateText)) {
    return res.status(400).json({
      success: false,
      message: `Follow-up update is required and must not exceed ${RESIDENT_FOLLOW_UP_MAX_LENGTH} characters.`,
    });
  }
  const followUpId = `follow-up-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await db.query(
    `
      INSERT INTO complaint_follow_ups (id, complaint_id, created_by, message)
      VALUES (?, ?, ?, ?)
    `,
    [followUpId, complaint.id, req.user.id, updateText],
  );
  await db.query(
    `
      INSERT INTO complaint_status_history (
        complaint_id, changed_by, previous_status, new_status, notes
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [complaint.id, req.user.id, currentStatus, currentStatus, updateText],
  );

  await addUserActivity(req.user.id, "Added complaint follow-up", {
    targetType: "complaint",
    targetId: complaint.id,
    complaint_id: complaint.id,
    details: complaint.title || "",
  });
  await addAdminNotification({
    title: "Complaint follow-up added",
    message: `${fullName(req.user)} added a follow-up to ${complaint.id}: ${complaint.title}.`,
    complaint_id: complaint.id,
  });

  return res.status(201).json({
    success: true,
    message: "Follow-up added.",
    data: await getDbComplaint(complaint.id),
  });
});

router.patch(
  "/:id/respondent",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const complaint = await getDbComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const isMoneyDebtComplaint =
      String(complaint.category || complaint.categoryBase || "") === "Money Debt";
    const respondentFields = normalizeRespondentFields(req.body || {});

    if (!isMoneyDebtComplaint) {
      respondentFields.respondent_name = "";
      respondentFields.respondent_contact_number = "";
      respondentFields.respondent_purok = "";
    }

    const respondentError = validateRespondentFields(respondentFields);
    if (isMoneyDebtComplaint && respondentError) {
      return res.status(400).json({
        success: false,
        message: respondentError,
      });
    }

    await db.query(
      `
        UPDATE complaints
        SET respondent_name = ?, respondent_contact_number = ?, respondent_purok = ?
        WHERE id = ?
      `,
      [
        respondentFields.respondent_name,
        respondentFields.respondent_contact_number,
        respondentFields.respondent_purok,
        req.params.id,
      ],
    );

    await addUserActivity(req.user.id, "Updated complaint respondent details", {
      targetType: "complaint",
      targetId: req.params.id,
      complaint_id: req.params.id,
      details: respondentFields.respondent_name || "Respondent details updated",
    });

    return res.json({
      success: true,
      message: "Respondent details updated.",
      data: await getDbComplaint(req.params.id),
    });
  },
);

// Soft delete / restore complaint. Active complaints are archived so they can
// be restored from the archive view.
router.patch(
  "/:id/archive",
  requireRoles("super_admin"),
  async (req, res) => {
    const complaint = await getDbComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const archived = Boolean(req.body.is_archived);

    if (archived && normalizeStatusValue(complaint.status) !== "resolved") {
      return res.status(400).json({
        success: false,
        message: "Only resolved complaints can be archived.",
      });
    }

    await db.query(
      `
        UPDATE complaints
        SET is_archived = ?,
            archived_at = ?
        WHERE id = ?
      `,
      [archived ? 1 : 0, archived ? new Date() : null, req.params.id],
    );

    await addUserActivity(
      req.user.id,
      archived ? "Archived complaint" : "Restored complaint",
      {
        targetType: "complaint",
        targetId: complaint.id,
        complaint_id: complaint.id,
        details: complaint.title || "",
      },
    );
    await addAdminNotification({
      title: archived ? "Complaint archived" : "Complaint restored",
      message: `${complaint.id} was ${archived ? "moved to the archive" : "restored to the active complaints list"}.`,
    });
    if (complaint.submitterId) {
      await addUserNotification(
        complaint.submitterId,
        archived ? "Complaint archived" : "Complaint restored",
        `Your complaint ${complaint.id} was ${archived ? "moved to the archive for record keeping" : "restored to the active list"}.`,
      );
    }

    res.json({ success: true, data: await getDbComplaint(req.params.id) });
  },
);

router.get("/:id/comments", async (req, res) => {
  const complaint = await getDbComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }

  if (!canAccessComplaint(req.user, { submitterId: complaint.submitterId })) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
    });
  }

  const [rows] = await db.query(
    `
      SELECT id, comment, is_internal AS isInternal, created_at AS createdAt, author_id AS authorId
      FROM complaint_comments
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `,
    [req.params.id],
  );

  const comments = rows.map((row) => ({
    id: row.id,
    comment: row.comment,
    isInternal: Boolean(row.isInternal),
    createdAt: row.createdAt,
    authorId: row.authorId,
  }));

  const visibleComments = isAdminUser(req.user)
    ? comments
    : comments.filter((comment) => !comment.isInternal);

  return res.json({ success: true, data: visibleComments });
});

module.exports = router;
