const express = require("express");
const router = express.Router();
const db = require("../db");
const {
  addUserActivity,
} = require("../data/dbActivity");

const {
  PASSWORD_POLICY_MESSAGE,
  isStrongEnoughPassword,
} = require("../utils/passwordPolicy");

const {
  getDbUserById,
  verifyDbUserPassword,
  updateDbUserPassword,
  isDbEmailRegistered,
  updateDbProfile,
  setDbPendingEmail,
} = require("../data/dbUsers");

const {
  createAuthToken,
  invalidateOutstandingTokens,
} = require("../data/dbAuthTokens");

const {
  sendEmailChangeVerificationEmail,
  sendEmailChangeNoticeEmail,
} = require("../services/emailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl(path, token) {
  const base = String(process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("APP_BASE_URL environment variable is required.");
  const url = new URL(path, `${base}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

function isSafeProfileImage(dataUrl) {
  if (!dataUrl) return true;
  if (typeof dataUrl !== "string" || dataUrl.length > 3 * 1024 * 1024) return false;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return false;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) return false;
  const hex = buffer.subarray(0, 12).toString("hex");
  return (
    hex.startsWith("89504e470d0a1a0a") ||
    hex.startsWith("ffd8ff") ||
    hex.startsWith("474946383761") ||
    hex.startsWith("474946383961") ||
    hex.startsWith("52494646")
  );
}

function profileResponse(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    profile_picture_url: user.profile_picture_url || "",
    email_verified_at: user.email_verified_at || null,
    pending_email: user.pending_email || "",
    created_at: user.created_at || null,
  };
}

// GET /api/profile - return the authenticated user's account info
router.get("/", async (req, res) => {
  try {
    const user = await getDbUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.json({ success: true, data: profileResponse(user) });
  } catch (error) {
    console.error("Profile fetch error:", error.message);
    res.status(500).json({ success: false, message: "Unable to load profile." });
  }
});

// PATCH /api/profile - update the authenticated user's own profile.
// Names are intentionally NOT accepted here — BSCCARS treats first/last name
// as identity-of-record (tied to verified ID and KP hearing notice
// documents), not a self-service profile field. Only email and photo are
// editable through this endpoint. Email changes additionally require the
// user's current password to confirm the account holder authorized the
// change.
router.get("/activity-log", async (req, res) => {
  const user = await getDbUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const [rows] = await db.query(
    `
      SELECT
        id,
        action,
        target_type AS targetType,
        target_id AS targetId,
        details,
        created_at AS timestamp
      FROM activity_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [req.user.id],
  );

  return res.json({ success: true, data: rows });
});

router.post("/change-password", async (req, res) => {
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Current and new password are required." });
  }

  const passwordMatches = await verifyDbUserPassword(req.user.id, currentPassword);

  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: "Current password is incorrect." });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: PASSWORD_POLICY_MESSAGE,
    });
  }

  await updateDbUserPassword(req.user.id, newPassword);
  await addUserActivity(req.user.id, "Changed account password", {
    targetType: "account",
    targetId: req.user.id,
    details: "Password updated",
  });

  return res.json({ success: true, message: "Password updated successfully." });
});

router.patch("/", async (req, res) => {
  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "first_name") ||
    Object.prototype.hasOwnProperty.call(req.body || {}, "last_name")
  ) {
    return res.status(400).json({
      success: false,
      message: "Name changes are not permitted through profile editing. Contact the Barangay Office to correct your name on record.",
    });
  }

  const currentUser = await getDbUserById(req.user.id);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const profile_picture_url = req.body?.profile_picture_url;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (typeof profile_picture_url !== "undefined" && !isSafeProfileImage(profile_picture_url)) {
    return res.status(400).json({ success: false, message: "Profile image is invalid or too large." });
  }

  const emailChanged = email !== currentUser.email.toLowerCase();

  if (emailChanged) {
    const currentPassword = String(req.body?.current_password || "");
    const passwordMatches = await verifyDbUserPassword(req.user.id, currentPassword);

    if (!currentPassword || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is required and must be correct to change your email address.",
      });
    }
    const emailTaken = await isDbEmailRegistered(email, req.user.id);

    if (emailTaken) {
      return res.status(409).json({ success: false, message: "That email address is already in use." });
    }
  }

  let user = await updateDbProfile(req.user.id, {
    profile_picture_url:
      typeof profile_picture_url === "string"
        ? profile_picture_url
        : currentUser.profile_picture_url || "",
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  if (emailChanged) {
    user = await setDbPendingEmail(req.user.id, email);
    await invalidateOutstandingTokens(req.user.id, "email_change");
    const { rawToken } = await createAuthToken(
      req.user.id,
      "email_change",
      process.env.EMAIL_CHANGE_TOKEN_TTL_MINUTES || "1440",
    );
    try {
      await sendEmailChangeVerificationEmail(currentUser, appUrl("verify_email.html", rawToken), email);
      await sendEmailChangeNoticeEmail(currentUser, email);
    } catch (error) {
      console.error("Email change notification failed:", error.message);
    }
  }

  await addUserActivity(user.id, emailChanged ? "Requested account email change" : "Updated profile photo", {
    targetType: "account",
    targetId: user.id,
    details: emailChanged
      ? "Email change verification sent."
      : "Profile photo updated",
  });
  return res.json({
    success: true,
    message: emailChanged
      ? "Check your new email address to verify the change."
      : "Profile updated successfully.",
    data: profileResponse(user),
  });
});

module.exports = router;
