const express = require("express");
const router = express.Router();

// Express 4 does not forward rejected async route promises automatically.
// Forward them to the shared error handler so database failures return a
// controlled response and are visible in the server log.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { VALID_ROLES } = require("../middleware/auth");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/auth");
const {
  addUserActivity,
  addActivityLog,
  addAdminNotification,
} = require("../data/dbActivity");
const {
  PASSWORD_POLICY_MESSAGE,
  isStrongEnoughPassword,
} = require("../utils/passwordPolicy");
const {
  getDbUserByEmail,
  getDbUserById,
  getDbUserWithPasswordByEmail,
  updateDbUserPassword,
  markDbUserEmailVerified,
  promoteDbPendingEmail,
  activateDbAdminWithPassword,
  isDbEmailRegistered,
  generateNextDbUserId,
  createDbResidentApplication,
  deleteDbUserById,
} = require("../data/dbUsers");
const {
  createAuthToken,
  findAuthToken,
  markAuthTokenUsed,
  invalidateOutstandingTokens,
  getTokenStatus,
} = require("../data/dbAuthTokens");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
} = require("../services/emailService");
const PASSWORD_SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_RESET_MESSAGE =
  "If an account is associated with this email address, we will send instructions to reset your password.";

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isAdult(dateOfBirthString) {
  const birthDate = new Date(dateOfBirthString);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 18;
}

async function getAccountByEmail(email) {
  return getDbUserByEmail(email);
}

async function verifyAccountPassword(user, password) {
  const stored = await getDbUserWithPasswordByEmail(user.email);
  return Boolean(
    stored?.password_hash && bcrypt.compareSync(password, stored.password_hash),
  );
}

async function isRegisteredEmail(email) {
  return isDbEmailRegistered(email);
}

async function updateAccountPassword(id, newPassword) {
  return updateDbUserPassword(id, newPassword);
}

function getAppBaseUrl() {
  const appBaseUrl = cleanString(process.env.APP_BASE_URL).replace(/\/+$/, "");
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL environment variable is required.");
  }
  return appBaseUrl;
}

function buildAppUrl(path, token) {
  const url = new URL(path, `${getAppBaseUrl()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendVerificationForUser(user) {
  const { rawToken } = await createAuthToken(
    user.id,
    "email_verification",
    process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || "1440",
  );
  try {
    await sendVerificationEmail(user, buildAppUrl("verify_email.html", rawToken));
  } catch (error) {
    await invalidateOutstandingTokens(user.id, "email_verification");
    throw error;
  }
}

// POST /api/auth/sign-in
router.post("/sign-in", asyncHandler(async (req, res) => {
  const email = cleanString(req.body?.email).toLowerCase();
  const password = cleanString(req.body?.password);

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing credentials",
    });
  }

  const normalizedEmail = email;
  const user = await getAccountByEmail(normalizedEmail);

  if (!user) {
    await addActivityLog({
      userId: null,
      action: "Failed Sign In",
      targetType: "account",
      details: "Invalid credentials",
    });
    return res.status(401).json({
      success: false,
      message: "Incorrect password please try again",
    });
  }

  if (!(await verifyAccountPassword(user, password))) {
    await addUserActivity(user.id, "Failed Sign In", {
      targetType: "account",
      targetId: user.id,
      details: "Invalid credentials",
    });
    return res.status(401).json({
      success: false,
      message: "Incorrect password please try again",
    });
  }

  if (!VALID_ROLES.has(user.role)) {
    return res.status(403).json({
      success: false,
      message: "This account has an unsupported role.",
    });
  }

  if (
    user.account_status === "inactive" ||
    (user.role === "resident" && user.status !== "Approved")
  ) {
    await addUserActivity(user.id, "Authorization failure", {
      targetType: "account",
      targetId: user.id,
      details: "Inactive or unapproved account attempted Sign In.",
    });
    return res.status(403).json({
      success: false,
      message:
        "This account is inactive. Contact the Barangay Captain for assistance.",
    });
  }

  await addUserActivity(user.id, "Signed in", {
    targetType: "account",
    targetId: user.id,
  });
  const token = signToken(user);
  return res.json({
    success: true,
    token,
    user,
  });
}));

// POST /api/auth/register
router.post("/register", asyncHandler(async (req, res) => {
  try {
    const email = cleanString(req.body.email).toLowerCase();
    const password = cleanString(req.body.password);
    const firstName = cleanString(req.body.firstName || req.body.first_name);
    const lastName = cleanString(req.body.lastName || req.body.last_name);
    const middleName = cleanString(
      req.body.middleName || req.body.middle_name,
    );
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
if (!isAdult(dateOfBirth)) {
      return res.status(400).json({
        success: false,
        message:
          "You must be at least 18 years old to register an account. If you are a minor with a concern to report, please ask a parent or guardian to file it using their own resident account.",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email format is invalid.",
      });
    }
    if (middleName.length === 1) {
      return res.status(400).json({
        success: false,
        message: "Please enter a complete middle name, not just an initial.",
      });
    }
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }
    if (!validId || !validId.dataUrl) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid ID.",
      });
    }
    if (await isRegisteredEmail(email)) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists or is pending approval.",
      });
    }

    const residentId = await generateNextDbUserId("RES");
    const passwordHash = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
    const resident = {
      id: residentId,
      firstName,
      lastName,
      middleName: middleName || null,
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
    };

    await createDbResidentApplication(resident, passwordHash);
    try {
      await sendVerificationForUser({
        id: resident.id,
        email: resident.email,
        first_name: resident.firstName,
        last_name: resident.lastName,
      });
    } catch (error) {
      console.error("Email verification send failed:", error.message);
      await deleteDbUserById(resident.id);
      return res.status(503).json({
        success: false,
        message:
          "We could not send the verification email. Your registration was not completed. Please try again later.",
      });
    }

    await addActivityLog({
      userId: resident.id,
      action: "Resident registration submitted",
      targetType: "resident",
      targetId: residentId,
      details: email,
    });

    await addAdminNotification({
      title: "New resident registration",
      message: `${firstName} ${lastName} registered and is awaiting approval.`,
    });

    return res.status(201).json({
      success: true,
      message:
        "Registration received. Please check your email to verify your address while your account is pending admin approval.",
      data: {
        id: resident.id,
        firstName: resident.firstName,
        middleName: resident.middleName || "",
        lastName: resident.lastName,
        suffix: resident.suffix,
        dateOfBirth: resident.dateOfBirth,
        purok: resident.purok,
        contactNumber: resident.contactNumber,
        email: resident.email,
        status: resident.status,
        archived: false,
        is_archived: false,
        validId: resident.validId,
        submittedAt: resident.submittedAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
}));

// GET /api/auth/verify-email?token=...
router.get("/verify-email", asyncHandler(async (req, res) => {
  const token = cleanString(req.query?.token);
  let row = await findAuthToken(token, "email_verification");
  if (!row) {
    row = await findAuthToken(token, "email_change");
  }
  const status = getTokenStatus(row);

  if (status !== "valid") {
    return res.status(400).json({
      success: false,
      status,
      message:
        status === "expired"
          ? "This verification link has expired."
          : status === "used"
            ? "This verification link has already been used."
            : "This verification link is invalid.",
    });
  }

  if (row.token_type === "email_change") {
    await promoteDbPendingEmail(row.user_id);
  } else {
    await markDbUserEmailVerified(row.user_id);
  }
  await markAuthTokenUsed(row.id);

  await addUserActivity(row.user_id, "Verified email address", {
    targetType: "account",
    targetId: row.user_id,
  });

  return res.json({
    success: true,
    message: "Email address verified successfully.",
  });
}));

// POST /api/auth/validate-admin-activation-token
router.post("/validate-admin-activation-token", asyncHandler(async (req, res) => {
  const token = cleanString(req.body?.token);
  const row = await findAuthToken(token, "admin_activation");
  const status = getTokenStatus(row);

  if (status !== "valid") {
    return res.status(400).json({
      success: false,
      status,
      message:
        status === "expired"
          ? "This activation link has expired."
          : status === "used"
            ? "This activation link has already been used."
            : "This activation link is invalid.",
    });
  }

  return res.json({ success: true, message: "Activation link is valid." });
}));

// POST /api/auth/activate-admin
router.post("/activate-admin", asyncHandler(async (req, res) => {
  const token = cleanString(req.body?.token);
  const newPassword = cleanString(req.body?.newPassword);
  const confirmPassword = cleanString(req.body?.confirmPassword);

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: "Activation token, password, and confirmation are required." });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }
  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ success: false, message: PASSWORD_POLICY_MESSAGE });
  }

  const row = await findAuthToken(token, "admin_activation");
  const status = getTokenStatus(row);
  if (status !== "valid") {
    return res.status(400).json({ success: false, status, message: "This activation link is invalid or expired." });
  }
  if (row.role !== "assistant_admin" && row.role !== "super_admin") {
    return res.status(400).json({ success: false, message: "This activation link is invalid." });
  }

  await activateDbAdminWithPassword(row.user_id, newPassword);
  await markAuthTokenUsed(row.id);
  await invalidateOutstandingTokens(row.user_id, "admin_activation");
  await addUserActivity(row.user_id, "Activated administrator account", {
    targetType: "account",
    targetId: row.user_id,
    details: "Administrator completed activation onboarding.",
  });

  return res.json({ success: true, message: "Administrator account activated. Please sign in." });
}));

// POST /api/auth/resend-verification-email
router.post("/resend-verification-email", asyncHandler(async (req, res) => {
  const email = cleanString(req.body?.email).toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  const user = await getDbUserWithPasswordByEmail(email);

  if (user && VALID_ROLES.has(user.role) && !user.email_verified_at) {
    await invalidateOutstandingTokens(user.id, "email_verification");
    try {
      await sendVerificationForUser(user);
    } catch (error) {
      console.error("Resend verification email failed:", error.message);
      return res.status(503).json({
        success: false,
        message:
          "We could not send the verification email. Please try again later.",
      });
    }
  }

  await addActivityLog({
    userId: user?.id || null,
    action: "Verification email resend requested",
    targetType: "account",
    targetId: user?.id || null,
    details: "Generic response returned.",
  });

  return res.json({
    success: true,
    message:
      "If an account with this email needs verification, we've sent a new verification link.",
  });
}));

// POST /api/auth/request-password-reset
router.post("/request-password-reset", asyncHandler(async (req, res) => {
  const email = cleanString(req.body?.email).toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  const user = await getDbUserWithPasswordByEmail(email);

  if (
    user &&
    VALID_ROLES.has(user.role) &&
    user.email_verified_at
  ) {
    await invalidateOutstandingTokens(user.id, "password_reset");
    const { rawToken } = await createAuthToken(
      user.id,
      "password_reset",
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "30",
    );
    try {
      await sendPasswordResetEmail(user, buildAppUrl("forgot_password.html", rawToken));
    } catch (error) {
      console.error("Password reset email send failed:", error.message);
      return res.status(503).json({
        success: false,
        message:
          "We could not send the password reset email. Please try again later.",
      });
    }
  }

  try {
    await addActivityLog({
      userId: user?.id || null,
      action: "Password reset requested",
      targetType: "account",
      targetId: user?.id || null,
      details: "Generic response returned.",
    });
  } catch (error) {
    // Auditing must not break password recovery. The generic response still
    // avoids revealing whether an account exists.
    console.error("Password reset activity log failed:", error.message);
  }

  return res.json({
    success: true,
    message: GENERIC_RESET_MESSAGE,
  });
}));

// POST /api/auth/validate-reset-token
router.post("/validate-reset-token", asyncHandler(async (req, res) => {
  const token = cleanString(req.body?.token);
  const row = await findAuthToken(token, "password_reset");
  const status = getTokenStatus(row);

  if (status !== "valid") {
    return res.status(400).json({
      success: false,
      status,
      message:
        status === "expired"
          ? "This reset link has expired."
          : status === "used"
            ? "This reset link has already been used."
            : "This reset link is invalid.",
    });
  }

  return res.json({
    success: true,
    message: "Reset link is valid.",
  });
}));

// POST /api/auth/reset-password
router.post("/reset-password", asyncHandler(async (req, res) => {
  const token = cleanString(req.body?.token);
  const newPassword = cleanString(req.body?.newPassword);
  const confirmPassword = cleanString(req.body?.confirmPassword);

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Reset token, new password, and confirmation are required.",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match.",
    });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  const row = await findAuthToken(token, "password_reset");
  const status = getTokenStatus(row);

  if (status !== "valid") {
    return res.status(400).json({
      success: false,
      status,
      message:
        status === "expired"
          ? "This reset link has expired."
          : status === "used"
            ? "This reset link has already been used."
            : "This reset link is invalid.",
    });
  }

  const updatedUser = await updateAccountPassword(row.user_id, newPassword);
  await markAuthTokenUsed(row.id);
  await invalidateOutstandingTokens(row.user_id, "password_reset");

  await addUserActivity(row.user_id, "Reset account password", {
    targetType: "account",
    targetId: row.user_id,
  });

  try {
    await sendPasswordResetConfirmationEmail({ ...updatedUser, email: row.email });
  } catch (error) {
    console.error("Password reset confirmation send failed:", error.message);
    return res.status(503).json({
      success: false,
      message:
        "Your password was reset, but we could not send the confirmation email.",
    });
  }

  return res.json({
    success: true,
    message:
      "Your password has been changed successfully. Please use your new password to sign in.",
  });
}));

module.exports = router;
