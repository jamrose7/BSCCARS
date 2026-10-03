const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const { addUserActivity } = require("../data/dbActivity");
const {
  getDbUserById,
  getDbUserByEmail,
  createDbAdmin,
  deleteDbUserById,
} = require("../data/dbUsers");
const {
  createAuthToken,
  invalidateOutstandingTokens,
} = require("../data/dbAuthTokens");
const { sendAdminActivationEmail } = require("../services/emailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl(path, token) {
  const base = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("APP_BASE_URL environment variable is required.");
  const url = new URL(path, `${base}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

router.use((req, res, next) => {
  if (req.user.account_status === "inactive") {
    return res.status(403).json({
      success: false,
      message: "Your administrator account is inactive. Contact an active Super Admin.",
    });
  }

  next();
});

router.use((req, res, next) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only Super Admin can manage administrator accounts.",
    });
  }

  next();
});

router.get("/", (req, res) => {
  return db
    .query(
      `
        SELECT id, first_name, last_name, email, role, account_status
        FROM users
        WHERE role IN ('super_admin', 'assistant_admin')
        ORDER BY created_at ASC
      `,
    )
    .then(([rows]) => res.json({ success: true, data: rows }));
});

router.post("/", async (req, res) => {
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = req.body?.role;

  if (role !== "super_admin" && role !== "assistant_admin") {
    return res.status(400).json({
      success: false,
      message: "Invalid administrator role.",
    });
  }

  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, and email are required.",
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  const existingUser = await getDbUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  }

  const unusablePasswordHash = bcrypt.hashSync(
    crypto.randomBytes(48).toString("base64url"),
    10,
  );
  const admin = await createDbAdmin({
    firstName,
    lastName,
    email,
    passwordHash: unusablePasswordHash,
    role,
  });
  const roleLabel = role === "super_admin" ? "Super Admin" : "Assistant Admin";
  let rawToken;
  try {
    ({ rawToken } = await createAuthToken(
      admin.id,
      "admin_activation",
      process.env.ADMIN_ACTIVATION_TOKEN_TTL_MINUTES || "1440",
    ));
  } catch (error) {
    console.error("Admin activation token failed:", error.message);
    await deleteDbUserById(admin.id);
    return res.status(500).json({
      success: false,
      message: "Could not create the activation link. The account was not created.",
    });
  }

  try {
    await sendAdminActivationEmail(admin, appUrl("admin_activation.html", rawToken));
  } catch (error) {
    console.error("Admin activation email send failed:", error.message);
    await deleteDbUserById(admin.id);
    return res.status(503).json({
      success: false,
      message:
        "We could not send the administrator activation email. The account was not created. Please try again later.",
    });
  }

  await addUserActivity(req.user.id, `Created ${roleLabel} account (inactive)`, {
    targetType: "account",
    targetId: admin.id,
    details: `${firstName} ${lastName} (${email}) created; requires activation before use.`,
  });

  return res.status(201).json({
    success: true,
    message: `${roleLabel} account created. An activation link was sent to the incoming administrator's email.`,
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

router.post("/:id/activate", async (req, res) => {
  return res.status(400).json({
    success: false,
    message:
      "Administrators must activate their own account from the emailed activation link.",
  });
});

router.post("/:id/deactivate", async (req, res) => {
  const target = await getDbUserById(req.params.id);
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
    const [rows] = await db.query(
      `
        SELECT id
        FROM users
        WHERE id <> ?
          AND role = 'super_admin'
          AND account_status = 'active'
        LIMIT 1
      `,
      [target.id],
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot deactivate the only active Super Admin. Activate a replacement first.",
      });
    }
  }

  await db.query("UPDATE users SET account_status = 'inactive' WHERE id = ?", [
    req.params.id,
  ]);

  const roleLabel = target.role === "super_admin" ? "Super Admin" : "Assistant Admin";
  await addUserActivity(req.user.id, `Deactivated ${roleLabel} account`, {
    targetType: "account",
    targetId: target.id,
    details: `${target.first_name} ${target.last_name} deactivated.`,
  });

  return res.json({
    success: true,
    message: `${roleLabel} account deactivated.`,
  });
});

module.exports = router;
