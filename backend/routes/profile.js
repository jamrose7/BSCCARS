const express = require("express");
const router = express.Router();
const {
  getUserById,
  updateUserProfile,
  isEmailTaken,
  addUserActivity,
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
router.patch("/", (req, res) => {
  const first_name = String(req.body?.first_name || "").trim();
  const last_name = String(req.body?.last_name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const profile_picture_url = req.body?.profile_picture_url;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ success: false, message: "First name, last name, and email are required." });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (typeof profile_picture_url !== "undefined" &&
      (typeof profile_picture_url !== "string" || profile_picture_url.length > 3 * 1024 * 1024)) {
    return res.status(400).json({ success: false, message: "Profile image is invalid or too large." });
  }
  if (isEmailTaken(email, req.user.id)) {
    return res.status(409).json({ success: false, message: "That email address is already in use." });
  }

  const user = updateUserProfile(req.user.id, {
    first_name,
    last_name,
    email,
    ...(typeof profile_picture_url === "string" ? { profile_picture_url } : {}),
  });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  addUserActivity(user.id, "Updated profile", { targetType: "account", targetId: user.id });
  return res.json({ success: true, data: profileResponse(user) });
});

module.exports = router;
