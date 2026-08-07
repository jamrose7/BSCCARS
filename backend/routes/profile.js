const express = require("express");
const router = express.Router();
const {
  getUserById,
  updateUserProfile,
  isEmailTaken,
  addUserActivity,
  verifyUserPassword,
  updateUserPassword,
} = require("../data/mockData");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function profileResponse(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    profile_picture_url: user.profile_picture_url || "",
    created_at: user.created_at || null,
  };
}

// GET /api/profile - return the authenticated user's account info
router.get("/", async (req, res) => {
  try {
    const user = getUserById(req.user.id);
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
router.get("/activity-log", (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  return res.json({ success: true, data: user.activity_logs || [] });
});

router.post("/change-password", (req, res) => {
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Current and new password are required." });
  }

  if (!verifyUserPassword(req.user.id, currentPassword)) {
    return res.status(401).json({ success: false, message: "Current password is incorrect." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters long." });
  }

  updateUserPassword(req.user.id, newPassword);
  addUserActivity(req.user.id, "Changed account password", {
    targetType: "account",
    targetId: req.user.id,
    details: "Password updated",
  });

  return res.json({ success: true, message: "Password updated successfully." });
});

router.patch("/", (req, res) => {
  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, "first_name") ||
    Object.prototype.hasOwnProperty.call(req.body || {}, "last_name")
  ) {
    return res.status(400).json({
      success: false,
      message: "Name changes are not permitted through profile editing. Contact the Barangay Office to correct your name on record.",
    });
  }

  const currentUser = getUserById(req.user.id);
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
  if (typeof profile_picture_url !== "undefined" &&
      (typeof profile_picture_url !== "string" || profile_picture_url.length > 3 * 1024 * 1024)) {
    return res.status(400).json({ success: false, message: "Profile image is invalid or too large." });
  }

  const emailChanged = email !== currentUser.email.toLowerCase();

  if (emailChanged) {
    const currentPassword = String(req.body?.current_password || "");
    if (!currentPassword || !verifyUserPassword(req.user.id, currentPassword)) {
      return res.status(401).json({
        success: false,
        message: "Current password is required and must be correct to change your email address.",
      });
    }
    if (isEmailTaken(email, req.user.id)) {
      return res.status(409).json({ success: false, message: "That email address is already in use." });
    }
  }

  const user = updateUserProfile(req.user.id, {
    email,
    ...(typeof profile_picture_url === "string" ? { profile_picture_url } : {}),
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  addUserActivity(user.id, emailChanged ? "Updated account email" : "Updated profile photo", {
    targetType: "account",
    targetId: user.id,
    details: emailChanged
      ? `Email changed from ${currentUser.email} to ${email}`
      : "Profile photo updated",
  });
  return res.json({ success: true, data: profileResponse(user) });
});

module.exports = router;
