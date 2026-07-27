const express = require("express");
const router = express.Router();
const {
  demoUsersByEmail,
  getUserById,
  getUserByEmail,
  addUserActivity,
  createAdministratorAccount,
} = require("../data/mockData");

// Defense-in-depth: a still-valid JWT belonging to a now-inactive admin
// (e.g. deactivated mid-session by someone else) should not retain access
// to admin-user management routes.
router.use((req, res, next) => {
  if (req.user.account_status === "inactive") {
    return res.status(403).json({
      success: false,
      message: "Your administrator account is inactive. Contact an active Super Admin.",
    });
  }

  next();
});

// Only Super Admin can manage administrator accounts.
router.use((req, res, next) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only Super Admin can manage administrator accounts.",
    });
  }

  next();
});

// GET /api/admin-users — list all admin accounts (super_admin + assistant_admin)
router.get("/", (req, res) => {
  const admins = Object.values(demoUsersByEmail)
    .filter((u) => u.role === "super_admin" || u.role === "assistant_admin")
    .map((u) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role: u.role,
      account_status: u.account_status || "active",
    }));
  return res.json({ success: true, data: admins });
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin-users — Step 1 of the turnover workflow.
// Creates a Super Admin or Assistant Admin account. Always starts
// Inactive; must be explicitly activated via POST /:id/activate.
router.post("/", (req, res) => {
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = req.body?.role;

  if (role !== "super_admin" && role !== "assistant_admin") {
    return res.status(400).json({
      success: false,
      message: "Invalid administrator role.",
    });
  }

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, email, and password are required.",
    });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long.",
    });
  }
  if (getUserByEmail(email)) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  }

  const admin = createAdministratorAccount({ firstName, lastName, email, password, role });
  const roleLabel = role === "super_admin" ? "Super Admin" : "Assistant Admin";

  addUserActivity(req.user.id, `Created ${roleLabel} account (inactive)`, {
    targetType: "account",
    targetId: admin.id,
    details: `${firstName} ${lastName} (${email}) created; requires activation before use.`,
  });

  return res.status(201).json({
    success: true,
    message: `${roleLabel} account created as Inactive. Activate it, verify sign-in, then deactivate the outgoing administrator.`,
    data: {
      id: admin.id,
      first_name: firstName,
      last_name: lastName,
      email,
      role,
      account_status: "inactive",
    },
  });
});

// POST /api/admin-users/:id/activate
router.post("/:id/activate", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, message: "User not found." });
  }
  if (target.role !== "super_admin" && target.role !== "assistant_admin") {
    return res.status(400).json({
      success: false,
      message: "Only admin accounts can be activated.",
    });
  }
  if ((target.account_status || "active") === "active") {
    return res.status(400).json({
      success: false,
      message: "Administrator account is already active.",
    });
  }
  target.account_status = "active";
  const roleLabel =
    target.role === "super_admin" ? "Super Admin" : "Assistant Admin";
  addUserActivity(req.user.id, "Activated " + roleLabel + " account", {
    targetType: "account",
    targetId: target.id,
    details: target.first_name + " " + target.last_name + " activated.",
  });
  return res.json({
    success: true,
    message: roleLabel + " account activated.",
  });
});

// POST /api/admin-users/:id/deactivate
router.post("/:id/deactivate", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, message: "User not found." });
  }
  if (target.role !== "super_admin" && target.role !== "assistant_admin") {
    return res.status(400).json({
      success: false,
      message: "Only admin accounts can be deactivated.",
    });
  }
  if (req.user.id === req.params.id) {
    return res.status(400).json({
      success: false,
      message: "You cannot deactivate your own account.",
    });
  }
  if (target.role === "super_admin") {
    const otherActiveSuper = Object.values(demoUsersByEmail).some(
      (u) =>
        u.id !== target.id &&
        u.role === "super_admin" &&
        (u.account_status || "active") === "active",
    );
    if (!otherActiveSuper) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot deactivate the only active Super Admin. Activate a replacement first.",
      });
    }
  }
  target.account_status = "inactive";
  const roleLabel =
    target.role === "super_admin" ? "Super Admin" : "Assistant Admin";
  addUserActivity(req.user.id, "Deactivated " + roleLabel + " account", {
    targetType: "account",
    targetId: target.id,
    details: target.first_name + " " + target.last_name + " deactivated.",
  });
  return res.json({
    success: true,
    message: roleLabel + " account deactivated.",
  });
});

module.exports = router;
 