require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const complaintsRoutes = require("./routes/complaints");
const reportsRoutes = require("./routes/reports");
const profileRoutes = require("./routes/profile");
const notificationRoutes = require("./routes/notifications");
const residentsRoutes = require("./routes/residents");
const activityRoutes = require("./routes/activity");
const hearingNoticeRoutes = require("./routes/hearingNotices");
const adminUsersRoutes = require("./routes/adminUsers");
const { authenticateToken, requireRoles } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
const publicRoot = path.join(__dirname, "..");

// Core Middleware

app.use(cors());

// Built-in Express body parsing (replaces body-parser)
// ID images are sent as Data URLs while the project is using its in-memory
// development store. A 5 MB image becomes roughly 6.7 MB after Base64
// encoding, so the parser must allow for that expansion.
app.use(express.json({ limit: "7mb" }));
app.use(express.urlencoded({ extended: true }));

// API Routes

app.use("/api/auth", authRoutes);
app.use("/api/notifications", authenticateToken, notificationRoutes);
app.use("/api/profile", authenticateToken, profileRoutes);
app.use("/api/residents", authenticateToken, residentsRoutes);
app.use("/api/complaints", authenticateToken, complaintsRoutes);
app.use("/api/hearing-notices", authenticateToken, hearingNoticeRoutes);
app.use(
  "/api/reports",
  authenticateToken,
  requireRoles("assistant_admin", "super_admin"),
  reportsRoutes,
);
app.use("/api/activity", authenticateToken, activityRoutes);
app.use(
  "/api/admin-users",
  authenticateToken,
  requireRoles("super_admin"),
  adminUsersRoutes,
);

// Static Frontend Assets
app.use(express.static(path.join(publicRoot, "html")));
app.use("/js", express.static(path.join(publicRoot, "js")));
app.use("/css", express.static(path.join(publicRoot, "css")));
app.use("/images", express.static(path.join(publicRoot, "images")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Root Route
app.get("/", (req, res) => {
  res.sendFile(path.join(publicRoot, "html", "index.html"));
});

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "BSCCARS backend" });
});

// Global Error Handler (basic placeholder)
// NOTE: This should be expanded into a centralized error system later

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Server Start

const server = app.listen(PORT, () => {
  console.log(`BSCCARS backend running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing backend process or run with a different port, for example: $env:PORT=3001; node backend/server.js`,
    );
    process.exit(1);
  }

  console.error("Unable to start BSCCARS backend:", error.message);
  process.exit(1);
});
