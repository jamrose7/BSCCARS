const express = require("express");
const router = express.Router();
const { requireRoles } = require("../middleware/auth");
const {
  residentApplications,
  addUser,
  getUserById,
  addUserActivity,
  addUserNotification,
  addAdminNotification,
  removeResidentRegistrationNotifications,
} = require("../data/mockData");

function findResident(id) {
  return residentApplications.find((resident) => resident.id === id);
}

function findResidentUser(id) {
  return getUserById(id);
}

function residentName(resident) {
  if (!resident) return "Resident";
  return (
    `${resident.firstName || resident.first_name || ""} ${
      resident.lastName || resident.last_name || ""
    }`
      .replace(/\s+/g, " ")
      .trim() || "Resident"
  );
}

// Both staff roles process resident applications; restriction
// actions below remain reserved for the Super Admin.
router.use(requireRoles("assistant_admin", "super_admin"));

// GET /api/residents/pending
router.get("/pending", (req, res) => {
  const pending = residentApplications.filter(
    (resident) => resident.status === "Pending" && !resident.archived,
  );
  res.json({ success: true, data: pending });
});

// GET /api/residents/all
router.get("/all", (req, res) => {
  res.json({ success: true, data: residentApplications });
});

// POST /api/residents/:id/approve
router.post("/:id/approve", (req, res) => {
  const resident = findResident(req.params.id);
  if (!resident) {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  resident.status = "Approved";
  removeResidentRegistrationNotifications(resident.id);
  addUser(
    {
      id: resident.id,
      email: resident.email,
      role: "resident",
      first_name: resident.firstName,
      last_name: resident.lastName,
      middle_name: resident.middleName,
    },
    "",
  );
  addUserActivity(req.user.id, "Approved resident registration", {
    targetType: "resident",
    targetId: resident.id,
    resident_id: resident.id,
    details: `${resident.firstName} ${resident.lastName}`.trim(),
  });
  addUserNotification(
    resident.id,
    "Resident account approved",
    "Your account has been approved. You can now submit and track complaints.",
  );
  res.json({ success: true, data: resident });
});

// POST /api/residents/:id/reject
router.post("/:id/reject", (req, res) => {
  const resident = findResident(req.params.id);
  if (!resident) {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  resident.status = "Rejected";
  removeResidentRegistrationNotifications(resident.id);
  addUserActivity(req.user.id, "Rejected resident registration", {
    targetType: "resident",
    targetId: resident.id,
    resident_id: resident.id,
    details: `${resident.firstName} ${resident.lastName}`.trim(),
  });
  addUserNotification(
    resident.id,
    "Resident account rejected",
    "Your account application was rejected. Please contact the Barangay Office for assistance.",
  );
  res.json({ success: true, data: resident });
});

// PATCH /api/residents/:id/archive
// Archive is the system's soft-delete: it hides the resident from active
// views while preserving the record (and any complaints tied to it) intact.
// There is no permanent-delete route — archived residents can only be
// restored via this same endpoint with is_archived: false.
router.patch("/:id/archive", requireRoles("super_admin"), (req, res) => {
  const resident = findResident(req.params.id);
  if (!resident) {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  resident.archived = Boolean(req.body.is_archived);
  resident.is_archived = resident.archived;
  resident.archivedAt = resident.archived ? new Date().toISOString() : null;
  addUserActivity(
    req.user.id,
    resident.archived ? "Archived resident" : "Restored resident",
    {
      targetType: "resident",
      targetId: resident.id,
      resident_id: resident.id,
      details: residentName(resident),
    },
  );
  addAdminNotification({
    title: resident.archived ? "Resident archived" : "Resident restored",
    message: `${residentName(resident)} was ${resident.archived ? "moved to the archive" : "restored from the archive"}.`,
  });
  addUserNotification(
    resident.id,
    resident.archived
      ? "Account application archived"
      : "Account application restored",
    `Your resident account application was ${resident.archived ? "moved to the archive" : "restored for processing"}.`,
  );
  res.json({ success: true, data: resident });
});

module.exports = router;
