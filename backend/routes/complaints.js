const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireRoles } = require("../middleware/auth");
const {
  getUserById,
  logResidentWarning,
  getUserWarnings,
  addUserActivity,
  addUserNotification,
  addAdminNotification,
  fullName,
  complaints,
} = require("../data/mockData");

const ADMIN_RESPONSE_MAX_LENGTH = 1500;
const RESPONDENT_MAX = {
  name: 255,
  contactNumber: 20,
  email: 255,
  address: 1000,
  purok: 100,
};
let complaintSequence = complaints.length + 1;
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
  "In-Person at Barangay Office",
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
    response.trim().length <= ADMIN_RESPONSE_MAX_LENGTH
  );
}

function shouldUseDatabase() {
  return Boolean(
    process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME,
  );
}

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanLongText(value) {
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
    respondent_email: cleanText(body.respondent_email || body.respondentEmail),
    respondent_address: cleanLongText(
      body.respondent_address || body.respondentAddress,
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
  if (fields.respondent_email.length > RESPONDENT_MAX.email) {
    return "Respondent email must be 255 characters or fewer.";
  }
  if (
    fields.respondent_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.respondent_email)
  ) {
    return "Respondent email format is invalid.";
  }
  if (fields.respondent_address.length > RESPONDENT_MAX.address) {
    return "Respondent address must be 1000 characters or fewer.";
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

function statusLabel(status) {
  return normalizeStatusValue(status)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatIncidentTime(value) {
  const time = String(value || "").trim();
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;

  const hour = Number(match[1]);
  const minutes = match[2];
  if (hour > 23 || Number(minutes) > 59) return time;
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
}

function enrichComplaint(complaint) {
  const resident = getUserById(complaint.submitterId);
  return {
    ...complaint,
    status: normalizeStatusValue(complaint.status),
    complainant: resident
      ? {
          id: resident.id,
          firstName: resident.first_name || "",
          middleName: resident.middle_name || "",
          lastName: resident.last_name || "",
          fullName: fullName(resident),
        }
      : {
          id: complaint.submitterId || "",
          firstName: "",
          middleName: "",
          lastName: "",
          fullName: "Unknown Resident",
        },
  };
}

function addComplaintTimelineEntry(complaint, entry) {
  complaint.statusHistory = complaint.statusHistory || [];
  complaint.statusHistory.push({
    id: `history-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

function findComplaint(id) {
  return complaints.find((complaint) => complaint.id === id);
}

function isAdminUser(user) {
  return ["assistant_admin", "super_admin"].includes(user?.role);
}

function canAccessComplaint(user, complaint) {
  return isAdminUser(user) || complaint.submitterId === user?.id;
}

function isArchived(complaint) {
  return Boolean(complaint.archived || complaint.is_archived);
}

function getOpenComplaints(userId) {
  return complaints.filter(
    (complaint) =>
      complaint.submitterId === userId &&
      !isArchived(complaint) &&
      ["pending", "in-progress"].includes(
        normalizeStatusValue(complaint.status),
      ),
  );
}

function getSameCategoryComplaints(
  userId,
  category,
  days = 30,
  resolvedOnly = false,
) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return complaints.filter((complaint) => {
    if (complaint.submitterId !== userId) {
      return false;
    }
    if (isArchived(complaint)) {
      return false;
    }
    if (complaint.category !== category) {
      return false;
    }

    const createdAt = new Date(complaint.createdAt).getTime();
    if (createdAt < cutoff) {
      return false;
    }

    if (resolvedOnly) {
      const status = String(complaint.status || "").toLowerCase();
      return normalizeStatusValue(status) === "resolved";
    }

    return true;
  });
}

function computeEligibility(user) {
  const open = getOpenComplaints(user.id).length;

  if (user.is_restricted && user.restricted_until) {
    const restrictedUntil = new Date(user.restricted_until);
    if (restrictedUntil >= new Date()) {
      return {
        eligible: false,
        reason: `Your complaint submission has been temporarily restricted until ${restrictedUntil.toLocaleDateString()}. Please contact the Barangay Office for assistance.`,
        open,
      };
    }

    user.is_restricted = false;
    user.restricted_until = null;
  }

  if (open >= 3) {
    return {
      eligible: false,
      reason:
        "You already have 3 active complaints. Please wait for one to be resolved before submitting a new one.",
      open,
    };
  }

  return {
    eligible: true,
    open,
  };
}

// GET all complaints
router.get("/", async (req, res) => {
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

  const data = complaints.map(enrichComplaint).filter((complaint) => {
    if (isArchived(complaint) && req.query.archived !== "true") return false;
    if (!isArchived(complaint) && req.query.archived === "true") return false;
    if (requestedStatus && complaint.status !== requestedStatus) return false;
    if (
      requestedPriority &&
      String(complaint.priority || "").toLowerCase() !== requestedPriority
    ) {
      return false;
    }
    if (requestedSubmitter && complaint.submitterId !== requestedSubmitter) {
      return false;
    }
    return true;
  });

  res.json({ success: true, data });
});

router.get("/check-eligibility", async (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found." });
  }

  const eligibility = computeEligibility(user);
  const warnings = getUserWarnings(user.id);

  return res.json({
    success: true,
    data: {
      ...eligibility,
      warnings: warnings || [],
      warningCount: warnings.length,
    },
  });
});

router.get("/public-feed", async (req, res) => {
  const data = complaints
    .filter((complaint) => !isArchived(complaint))
    .map((complaint) => {
      const resident = getUserById(complaint.submitterId);
      const isConfidential = ["yes", "confidential"].includes(
        String(complaint.confidential || "")
          .trim()
          .toLowerCase(),
      );

      return {
        id: complaint.id,
        title: complaint.title || "Untitled complaint",
        category: complaint.category || "Uncategorized",
        purok: complaint.purok || "",
        date: (complaint.incidentDate || complaint.createdAt || "").slice(
          0,
          10,
        ),
        time: formatIncidentTime(complaint.incidentTime),
        status: statusLabel(complaint.status),
        details: complaint.details || "",
        submittedBy: isConfidential ? "Anonymous" : fullName(resident),
      };
    });

  res.json({ success: true, data });
});

router.get("/:id/hearing-notices", async (req, res) => {
  if (shouldUseDatabase()) {
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
  }

  const complaint = findComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }

  if (!canAccessComplaint(req.user, complaint)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
    });
  }

  const notices = (complaint.hearingNotices || []).map((notice) => ({
    ...notice,
    stage: notice.stage || "first_mediation",
    outcome: notice.outcome || "pending",
  }));

  notices.sort((a, b) =>
    String(a.created_at || a.createdAt || "").localeCompare(
      String(b.created_at || b.createdAt || ""),
    ),
  );

  res.json({ success: true, data: notices });
});

// GET complaint by ID
router.get("/:id", async (req, res) => {
  const complaint = findComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }

  if (!canAccessComplaint(req.user, complaint)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
    });
  }

  res.json({ success: true, data: enrichComplaint(complaint) });
});

// CREATE complaint
router.post(
  "/",
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
  async (req, res) => {
    const user = getUserById(req.user.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found." });
    }

    const eligibility = computeEligibility(user);
    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: eligibility.reason,
        data: { openComplaints: eligibility.open },
      });
    }

    const complaintData = req.body;
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    const cleanupUploadedFiles = () => {
      if (imageFile) fs.unlink(imageFile.path, () => {});
      if (videoFile) fs.unlink(videoFile.path, () => {});
    };

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
        path: `/uploads/complaints/${imageFile.filename}`,
      });
    }

    if (videoFile) {
      attachments.push({
        type: "video",
        originalName: videoFile.originalname,
        path: `/uploads/complaints/${videoFile.filename}`,
      });
    }

    const previousSameCategoryCount30 = getSameCategoryComplaints(
      user.id,
      displayCategory,
      30,
    ).length;
    const hasRecentResolvedSameCategory15 =
      getSameCategoryComplaints(user.id, displayCategory, 15, true).length > 0;
    const createdAt = new Date().toISOString();
    const isAutoHighPriority = AUTO_HIGH_PRIORITY_CATEGORIES.includes(category);
    const normalizedPriority = String(complaintData.priority || "Normal")
      .trim()
      .toLowerCase();
    const requestedHighPriority = normalizedPriority === "high";
    const finalPriority = isAutoHighPriority ? "High" : "Normal";

    if (requestedHighPriority && !isAutoHighPriority) {
      addUserActivity(user.id, "High priority override", {
        complaint_title: title,
        category,
        requested_priority: "High",
        applied_priority: "Normal",
      });
    }

    if (previousSameCategoryCount30 >= 3) {
      user.is_restricted = true;
      user.restricted_until = null;
      logResidentWarning({
        residentId: user.id,
        complaintId: null,
        type: "account_suspended",
        reason:
          "Fourth same-category complaint within 30 days. Account suspended for review by the Barangay Captain.",
      });
    } else if (previousSameCategoryCount30 === 2) {
      const restrictionDate = new Date();
      restrictionDate.setDate(restrictionDate.getDate() + 7);
      const restrictionUntil = restrictionDate.toISOString().slice(0, 10);
      user.is_restricted = true;
      user.restricted_until = restrictionUntil;
      logResidentWarning({
        residentId: user.id,
        complaintId: null,
        type: "submission_restricted",
        reason:
          "Third same-category complaint within 30 days. Submission restricted for 7 days while the pending complaint is reviewed.",
        expiresAt: restrictionUntil,
      });
    }

    const createdComplaint = {
      id: formatComplaintNumber(complaintSequence++),
      submitterId: user.id,
      title,
      category: displayCategory,
      categoryBase: category,
      categorySpecify: category === "Other" ? categorySpecify : "",
      details,
      ...respondentFields,
      purok,
      incidentDate: complaintData.incidentDate || null,
      incidentTime: complaintData.incidentTime || null,
      priority: finalPriority,
      confidential:
        complaintData.anonymous === "true" || complaintData.anonymous === true
          ? "Yes"
          : "No",
      status: "pending",
      source: "Digital Submission",
      createdAt,
      attachments,
      comments: [],
      statusHistory: [
        {
          id: `history-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          label: "Submitted",
          previousStatus: null,
          newStatus: "pending",
          changedBy: user.id,
          notes: "",
          createdAt,
        },
      ],
    };

    if (isAutoHighPriority) {
      addUserActivity(user.id, "Auto-priority assignment", {
        complaint_id: createdComplaint.id,
        category: createdComplaint.category,
        forced_priority: createdComplaint.priority,
      });

      addAdminNotification({
        title: "URGENT: A High Priority complaint has been submitted",
        message: `URGENT: A High Priority complaint has been submitted under ${createdComplaint.category}. Immediate review is required.`,
      });
    }

    complaints.unshift(createdComplaint);
    addUserActivity(user.id, "Submitted complaint", {
      targetType: "complaint",
      targetId: createdComplaint.id,
      complaint_id: createdComplaint.id,
      details: createdComplaint.title,
    });
    addAdminNotification({
      title: "New complaint submitted",
      message: `${fullName(user)} submitted ${createdComplaint.id}: ${createdComplaint.title}.`,
    });

    if (previousSameCategoryCount30 >= 3) {
      addUserNotification(
        user.id,
        "Your complaint has been submitted and your account is under review.",
        "Your complaint has been submitted successfully. We noticed multiple complaints under the same category within 30 days. Your account is temporarily restricted and will be reviewed by the Barangay Captain.",
      );
      addAdminNotification({
        title:
          "Urgent: Resident account suspended for repeated same-category complaints",
        message: `Note: ${user.first_name} ${user.last_name} has submitted a complaint under ${displayCategory} within 30 days of previous complaints in the same category. The account is now suspended for review.`,
        roles: ["super_admin"],
      });
    } else if (previousSameCategoryCount30 === 2) {
      addUserNotification(
        user.id,
        "Your complaint has been submitted and is under review.",
        "Your complaint has been submitted successfully. We noticed multiple complaints under the same category within 30 days. It remains Pending while barangay staff review it.",
      );
      addAdminNotification({
        title:
          "Notice: Resident has submitted a repeated same-category complaint",
        message: `Note: ${fullName(user)} has submitted a complaint under ${displayCategory} within 30 days of previous complaints in the same category. It remains pending for review.`,
      });
    } else if (hasRecentResolvedSameCategory15) {
      addUserNotification(
        user.id,
        "Your complaint has been submitted successfully.",
        "Your complaint has been submitted successfully. We noticed you have recently submitted a concern under the same category. The barangay will review your records. Please ensure each complaint describes a new and distinct situation.",
      );
      addAdminNotification({
        title: "Note: Resident submitted a similar complaint within 15 days",
        message: `Note: ${user.first_name} ${user.last_name} has submitted a complaint under ${displayCategory} within 15 days of a previously resolved complaint in the same category. No action required — for your awareness only.`,
      });
    }

    return res.status(201).json({
      success: true,
      data: enrichComplaint(createdComplaint),
    });
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

    if (notes && !validateAdminResponse(notes)) {
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

    const complaint = findComplaint(id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const previousStatus = normalizeStatusValue(complaint.status);
    complaint.status = normalizedStatus;
    complaint.adminNotes = notes || complaint.adminNotes || null;
    if (sourceUpdate) {
      complaint.source = sourceUpdate.source;
      complaint.sourceBase = sourceUpdate.sourceBase;
      complaint.sourceSpecify = sourceUpdate.sourceSpecify;
    }
    if (normalizedStatus === "resolved" && !complaint.resolvedAt) {
      complaint.resolvedAt = new Date().toISOString();
    }

    addComplaintTimelineEntry(complaint, {
      label: "Status updated",
      previousStatus,
      newStatus: normalizedStatus,
      changedBy: req.user.id,
      notes: notes || "",
    });

    addUserActivity(req.user.id, "Updated complaint status", {
      targetType: "complaint",
      targetId: complaint.id,
      complaint_id: complaint.id,
      details: `${statusLabel(previousStatus)} to ${statusLabel(normalizedStatus)}`,
    });
    if (complaint.submitterId) {
      addUserNotification(
        complaint.submitterId,
        `Complaint ${complaint.id} status updated`,
        `Your complaint is now ${statusLabel(normalizedStatus)}.`,
      );
    }

    res.json({
      success: true,
      message: "Status updated",
      data: enrichComplaint(complaint),
    });
  },
);

router.post(
  "/:id/comment",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { comment, isInternal = false } = req.body;

    if (!validateAdminResponse(comment)) {
      return res.status(400).json({
        success: false,
        message: `Admin response must not exceed ${ADMIN_RESPONSE_MAX_LENGTH} characters.`,
      });
    }

    const complaint = findComplaint(id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const newComment = {
      id: `comment-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      comment: comment.trim(),
      isInternal: Boolean(isInternal),
      createdAt: new Date().toISOString(),
    };

    complaint.comments = complaint.comments || [];
    complaint.comments.push(newComment);

    res.status(201).json({
      success: true,
      message: "Comment added",
      data: newComment,
    });
  },
);

router.patch(
  "/:id/respondent",
  requireRoles("assistant_admin", "super_admin"),
  async (req, res) => {
    const complaint = findComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const respondentFields = normalizeRespondentFields(req.body || {});
    const respondentError = validateRespondentFields(respondentFields);
    if (respondentError) {
      return res.status(400).json({
        success: false,
        message: respondentError,
      });
    }

    Object.assign(complaint, respondentFields);
    addUserActivity(req.user.id, "Updated complaint respondent details", {
      targetType: "complaint",
      targetId: complaint.id,
      complaint_id: complaint.id,
      details: respondentFields.respondent_name || "Respondent details updated",
    });

    res.json({
      success: true,
      message: "Respondent details updated.",
      data: enrichComplaint(complaint),
    });
  },
);

// Soft delete / restore complaint. Active complaints are archived so they can
// be restored from the archive view.
router.patch(
  "/:id/archive",
  requireRoles("super_admin"),
  async (req, res) => {
    const complaint = findComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    const archived = Boolean(req.body.is_archived);
    complaint.archived = archived;
    complaint.is_archived = archived;
    complaint.archivedAt = archived ? new Date().toISOString() : null;

    addUserActivity(
      req.user.id,
      archived ? "Archived complaint" : "Restored complaint",
      {
        targetType: "complaint",
        targetId: complaint.id,
        complaint_id: complaint.id,
        details: complaint.title || "",
      },
    );
    addAdminNotification({
      title: archived ? "Complaint archived" : "Complaint restored",
      message: `${complaint.id} was ${archived ? "moved to the archive" : "restored to the active complaints list"}.`,
    });
    if (complaint.submitterId) {
      addUserNotification(
        complaint.submitterId,
        archived ? "Complaint archived" : "Complaint restored",
        `Your complaint ${complaint.id} was ${archived ? "moved to the archive for record keeping" : "restored to the active list"}.`,
      );
    }

    res.json({ success: true, data: enrichComplaint(complaint) });
  },
);

// DELETE is only destructive after an item is already archived. If an active
// complaint is deleted, treat it as a recoverable archive action.
router.delete(
  "/:id",
  requireRoles("super_admin"),
  async (req, res) => {
    const complaint = findComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found." });
    }

    if (!isArchived(complaint)) {
      complaint.archived = true;
      complaint.is_archived = true;
      complaint.archivedAt = new Date().toISOString();
      addUserActivity(req.user.id, "Archived complaint through delete action", {
        targetType: "complaint",
        targetId: complaint.id,
        complaint_id: complaint.id,
        details: complaint.title || "",
      });
      addAdminNotification({
        title: "Complaint moved to archive",
        message: `${complaint.id} was not permanently deleted. It is available in the archive for restore or final deletion.`,
      });
      return res.json({
        success: true,
        message: "Complaint moved to archive.",
        data: enrichComplaint(complaint),
      });
    }

    const index = complaints.findIndex((item) => item.id === complaint.id);
    const [deleted] = complaints.splice(index, 1);
    addUserActivity(req.user.id, "Permanently deleted archived complaint", {
      targetType: "complaint",
      targetId: deleted.id,
      complaint_id: deleted.id,
      details: deleted.title || "",
    });
    addAdminNotification({
      title: "Archived complaint permanently deleted",
      message: `${deleted.id} was permanently deleted from archived complaints.`,
    });

    res.json({ success: true, data: enrichComplaint(deleted) });
  },
);

router.get("/:id/comments", async (req, res) => {
  const complaint = findComplaint(req.params.id);
  if (!complaint) {
    return res
      .status(404)
      .json({ success: false, message: "Complaint not found." });
  }

  if (!canAccessComplaint(req.user, complaint)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this complaint.",
    });
  }

  const comments = isAdminUser(req.user)
    ? complaint.comments || []
    : (complaint.comments || []).filter((comment) => !comment.isInternal);

  res.json({ success: true, data: comments });
});

module.exports = router;
