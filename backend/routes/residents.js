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
  removeUserById,
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

// Both staff roles process resident applications; destructive and restriction
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

// DELETE /api/residents/:id
// Active records are soft-deleted into the archive. Only archived records are
// permanently removed.
router.delete("/:id", requireRoles("super_admin"), (req, res) => {
  const index = residentApplications.findIndex(
    (resident) => resident.id === req.params.id,
  );
  if (index === -1) {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  const resident = residentApplications[index];
  const archived = Boolean(resident.archived || resident.is_archived);
  if (!archived) {
    resident.archived = true;
    resident.is_archived = true;
    resident.archivedAt = new Date().toISOString();
    addUserActivity(req.user.id, "Archived resident through delete action", {
      targetType: "resident",
      targetId: resident.id,
      resident_id: resident.id,
      details: residentName(resident),
    });
    addAdminNotification({
      title: "Resident moved to archive",
      message: `${residentName(resident)} was not permanently deleted. The record can be restored from the archive.`,
    });
    addUserNotification(
      resident.id,
      "Account application archived",
      "Your resident account application was moved to the archive for record keeping.",
    );
    return res.json({
      success: true,
      message: "Resident moved to archive.",
      data: resident,
    });
  }

  const [deleted] = residentApplications.splice(index, 1);
  removeResidentRegistrationNotifications(deleted.id);
  removeUserById(deleted.id);
  addUserActivity(req.user.id, "Permanently deleted archived resident", {
    targetType: "resident",
    targetId: deleted.id,
    resident_id: deleted.id,
    details: residentName(deleted),
  });
  addAdminNotification({
    title: "Archived resident permanently deleted",
    message: `${residentName(deleted)} was permanently deleted from archived resident records.`,
  });
  res.json({ success: true, data: deleted });
});

module.exports = router;
