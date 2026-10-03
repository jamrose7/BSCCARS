const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireRoles } = require("../middleware/auth");
const {
  addUserActivity,
  addUserNotification,
  addAdminNotification,
} = require("../data/dbActivity");
const { getDbUserById } = require("../data/dbUsers");

function dbResidentToApi(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    middleName: row.middle_name || "",
    lastName: row.last_name,
    suffix: row.suffix || "None",
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : "",
    purok: row.purok || "",
    contactNumber: row.contact_number || "",
    email: row.email,
    emailVerifiedAt: row.email_verified_at || null,
    validId: row.valid_id_name
      ? {
          name: row.valid_id_name,
          type: row.valid_id_type || "",
          dataUrl: row.valid_id_data || "",
        }
      : null,
    status: row.application_status,
    archived: Boolean(row.is_archived),
    is_archived: Boolean(row.is_archived),
    archivedAt: row.archived_at,
    submittedAt: row.created_at,
  };
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

router.use(requireRoles("assistant_admin", "super_admin"));

router.get("/pending", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT *
      FROM users
      WHERE role = 'resident'
        AND application_status = 'Pending'
        AND is_archived = FALSE
      ORDER BY created_at DESC
    `,
  );
  return res.json({ success: true, data: rows.map(dbResidentToApi) });
});

router.get("/all", async (req, res) => {
  const [rows] = await db.query(
    `
      SELECT *
      FROM users
      WHERE role = 'resident'
      ORDER BY created_at DESC
    `,
  );
  return res.json({ success: true, data: rows.map(dbResidentToApi) });
});

router.post("/:id/approve", async (req, res) => {
  const resident = await getDbUserById(req.params.id);
  if (!resident || resident.role !== "resident") {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  await db.query(
    `
      UPDATE users
      SET application_status = 'Approved',
          account_status = 'active'
      WHERE id = ? AND role = 'resident'
    `,
    [req.params.id],
  );

  await addUserActivity(req.user.id, "Approved resident registration", {
    targetType: "resident",
    targetId: req.params.id,
    resident_id: req.params.id,
    details: `${resident.first_name} ${resident.last_name}`.trim(),
  });

  await addUserNotification(
    req.params.id,
    "Resident account approved",
    "Your account has been approved. You can now submit and track complaints.",
  );

  return res.json({
    success: true,
    data: { ...resident, status: "Approved", account_status: "active" },
  });
});

router.post("/:id/reject", async (req, res) => {
  const resident = await getDbUserById(req.params.id);
  if (!resident || resident.role !== "resident") {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  const reason = String(req.body?.reason || "").trim();

  await db.query(
    `
      UPDATE users
      SET application_status = 'Rejected',
          account_status = 'inactive'
      WHERE id = ? AND role = 'resident'
    `,
    [req.params.id],
  );

  await addUserActivity(req.user.id, "Rejected resident registration", {
    targetType: "resident",
    targetId: req.params.id,
    resident_id: req.params.id,
    details: reason
      ? `${resident.first_name} ${resident.last_name} — Reason: ${reason}`.trim()
      : `${resident.first_name} ${resident.last_name}`.trim(),
  });

  await addUserNotification(
    req.params.id,
    "Resident account rejected",
    reason
      ? `Your account application was rejected. Reason: ${reason}`
      : "Your account application was rejected. Please contact the Barangay Office for assistance.",
  );

  return res.json({
    success: true,
    data: {
      ...resident,
      status: "Rejected",
      account_status: "inactive",
    },
  });
});

router.patch("/:id/archive", requireRoles("super_admin"), async (req, res) => {
  const resident = await getDbUserById(req.params.id);
  if (!resident || resident.role !== "resident") {
    return res
      .status(404)
      .json({ success: false, message: "Resident not found." });
  }

  const archived = Boolean(req.body.is_archived);
  await db.query(
    `
      UPDATE users
      SET is_archived = ?,
          archived_at = ?
      WHERE id = ? AND role = 'resident'
    `,
    [archived ? 1 : 0, archived ? new Date() : null, req.params.id],
  );

  await addUserActivity(
    req.user.id,
    archived ? "Archived resident" : "Restored resident",
    {
      targetType: "resident",
      targetId: req.params.id,
      resident_id: req.params.id,
      details: residentName(resident),
    },
  );

  await addAdminNotification({
    title: archived ? "Resident archived" : "Resident restored",
    message: `${residentName(resident)} was ${
      archived ? "moved to the archive" : "restored from the archive"
    }.`,
  });
  await addUserNotification(
    req.params.id,
    archived ? "Account application archived" : "Account application restored",
    `Your resident account application was ${
      archived ? "moved to the archive" : "restored for processing"
    }.`,
  );

  return res.json({
    success: true,
    data: {
      ...resident,
      archived,
      is_archived: archived,
    },
  });
});

module.exports = router;
