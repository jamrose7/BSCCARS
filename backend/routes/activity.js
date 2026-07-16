const express = require("express");
const { requireRoles } = require("../middleware/auth");
const { getActivityLogs } = require("../data/mockData");

const router = express.Router();

// System-wide activity oversight is reserved for the Super Admin.
router.use(requireRoles("super_admin"));

router.get("/", (req, res) => {
  res.json({ success: true, data: getActivityLogs() });
});

module.exports = router;
