const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { VALID_ROLES } = require("../middleware/auth");
const {
  getUserByEmail,
  signToken,
  addUserActivity,
  addActivityLog,
  addAdminNotification,
  verifyUserPassword,
  updateUserPassword,
  isEmailRegistered,
  generateNextUserId,
  residentApplications,
  toSafeResident,
} = require("../data/mockData");

const PASSWORD_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

// POST /api/auth/sign-in
router.post("/sign-in", async (req, res) => {
  const email = cleanString(req.body?.email).toLowerCase();
  const password = cleanString(req.body?.password);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing credentials",
    });
  }

  const normalizedEmail = email;
  const user = getUserByEmail(normalizedEmail);

  if (!user || !verifyUserPassword(user.id, password)) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  if (!VALID_ROLES.has(user.role)) {
    return res.status(403).json({
      success: false,
      message: "This account has an unsupported role.",
    });
  }

  addUserActivity(user.id, "Signed in", {
    targetType: "account",
    targetId: user.id,
  });
  const token = signToken(user);
  return res.json({
    success: true,
    token,
    user,
  });
});

// POST /api/auth/register
//
// Registration no longer creates a logged-in-capable account directly.
// It creates a Pending entry in residentApplications, exactly like the
// admin Residents page expects. The account only becomes real (added to
// demoUsersByEmail, able to sign in) once an admin approves it via
// POST /api/residents/:id/approve, which calls
// promotePendingResidentToUser() using the password hash set here.
router.post("/register", async (req, res) => {
  try {
    const email = cleanString(req.body.email).toLowerCase();
    const password = cleanString(req.body.password);
    const firstName = cleanString(req.body.firstName || req.body.first_name);
    const lastName = cleanString(req.body.lastName || req.body.last_name);
    const middleNameRaw = cleanString(req.body.middleName || req.body.middle_name);
    const noMiddleName = Boolean(req.body.noMiddleName);
    const suffix = cleanString(req.body.suffix) || "None";
    const dateOfBirth = cleanString(req.body.dateOfBirth);
    const purok = cleanString(req.body.purok);
    const contactNumber = cleanString(req.body.contactNumber);
    const validId = req.body.validId;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !dateOfBirth ||
      !purok ||
      !contactNumber
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields.",
      });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email format is invalid.",
      });
    }
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }
    if (!validId || !validId.dataUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid ID.",
      });
    }
    if (isEmailRegistered(email)) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists or is pending approval.",
      });
    }

    const residentId = generateNextUserId();
    const passwordHash = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);

    const resident = {
      id: residentId,
      firstName,
      lastName,
      middleName: noMiddleName ? null : middleNameRaw || null,
      noMiddleName,
      suffix,
      dateOfBirth,
      purok,
      contactNumber,
      email,
      status: "Pending",
      archived: false,
      is_archived: false,
      validId: {
        name: validId.name || "Uploaded ID",
        type: validId.type || "",
        dataUrl: validId.dataUrl,
      },
      warning_count: 0,
      is_restricted: false,
      submittedAt: new Date().toISOString(),
      _passwordHash: passwordHash, // never sent to the client; see toSafeResident
    };

    residentApplications.push(resident);

    addActivityLog({
      userId: null,
      userName: `${firstName} ${lastName}`.trim(),
      action: "Resident registration submitted",
      targetType: "resident",
      targetId: residentId,
      details: email,
    });

    addAdminNotification({
      title: "New resident registration",
      message: `${firstName} ${lastName} registered and is awaiting approval.`,
    });

    return res.status(201).json({
      success: true,
      message: "Registration received. Your account is pending admin approval.",
      data: toSafeResident(resident),
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", (req, res) => {
  const email = cleanString(req.body?.email).toLowerCase();
  const newPassword = cleanString(req.body?.newPassword);
  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }
  const normalizedEmail = email;
  const user = getUserByEmail(normalizedEmail);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Account details do not match our records.",
    });
  }
  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long.",
    });
  }

  updateUserPassword(user.id, newPassword);
  addUserActivity(user.id, "Reset account password", {
    targetType: "account",
    targetId: user.id,
  });

  return res.json({ success: true, message: "Password reset successful" });
});

module.exports = router;
