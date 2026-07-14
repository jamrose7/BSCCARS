const express = require("express");
const { requireRoles } = require("../middleware/auth");
const { getActivityLogs } = require("../data/mockData");

const router = express.Router();

router.use(requireRoles("assistant_admin", "super_admin"));

router.get("/", (req, res) => {
  res.json({ success: true, data: getActivityLogs() });
});

module.exports = router;
