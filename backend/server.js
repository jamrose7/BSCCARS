const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const db = require("./db");

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
const DEFAULT_PORT = 3000;
const PORT = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10) || DEFAULT_PORT;
const publicRoot = path.join(__dirname, "..");
const usingDatabase = Boolean(
  process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME,
);

if (process.env.NODE_ENV === "production" && !usingDatabase) {
  throw new Error(
    "Production requires database configuration. In-memory mock data is not acceptable for production.",
  );
}

// Core Middleware
app.set("trust proxy", 1);

app.use(
  helmet({
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrcAttr: ["'unsafe-inline'"], 
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        // The development/demo server uses HTTP on a private LAN address.
        // Forcing subresources to HTTPS would make CSS, images, and scripts fail.
        upgradeInsecureRequests: null,
      },
    },
  }),
);

if (process.env.ENFORCE_HTTPS === "true") {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      return next();
    }

    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  });
}

const allowedOrigins = [
  "http://localhost:3000",
  // add your deployed frontend URL here when you deploy
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Built-in Express body parsing (replaces body-parser)
// ID images are sent as Data URLs. A 5 MB image becomes roughly 6.7 MB after Base64
// encoding, so the parser must allow for that expansion.
app.use(express.json({ limit: "7mb" }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const ip = ipKeyGenerator(req.ip);
    return `${ip}:${email || "unknown"}`;
  },
  message: {
    success: false,
    message: "Too many attempts. Please try again in a few minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token validation requests contain no email address. They need a normal
// IP-based limiter instead of the email-and-IP limiter used by form requests.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many attempts. Please try again in a few minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/sign-in", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/request-password-reset", authLimiter);
app.use("/api/auth/validate-reset-token", tokenLimiter);
app.use("/api/auth/reset-password", tokenLimiter);
app.use("/api/auth/validate-admin-activation-token", tokenLimiter);
app.use("/api/auth/activate-admin", tokenLimiter);
app.use("/api/auth/resend-verification-email", authLimiter);
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

app.get("/api/uploads/complaints/:filename", authenticateToken, async (req, res) => {
  const uploadRoot = path.resolve(__dirname, "uploads", "complaints");
  const requestedPath = path.resolve(uploadRoot, req.params.filename);
  const relativeTarget = path.relative(uploadRoot, requestedPath);

  // Preserve the existing path-traversal protection.
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }

  // Determine which complaint this attachment belongs to, so that
  // authorization can be enforced before the file is served.
  const storagePath = `/api/uploads/complaints/${req.params.filename}`;
  let attachmentRow;
  try {
    const [rows] = await db.query(
      `
        SELECT ca.complaint_id, c.submitter_id
        FROM complaint_attachments ca
        JOIN complaints c ON c.id = ca.complaint_id
        WHERE ca.storage_path = ?
        LIMIT 1
      `,
      [storagePath],
    );
    attachmentRow = rows[0] || null;
  } catch (error) {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }

  if (!attachmentRow) {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }

  // Enforce the existing BSCCARS authorization model:
  // admins may access any complaint attachment; a resident may only
  // access attachments belonging to their own complaint.
  const isAdmin = ["assistant_admin", "super_admin"].includes(req.user.role);
  if (!isAdmin && attachmentRow.submitter_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "You do not have permission to access this attachment." });
  }

  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    return res.status(404).json({ success: false, message: "Attachment not found." });
  }

  const ext = path.extname(requestedPath).toLowerCase();
  const contentTypeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
  };

  res.setHeader("Content-Type", contentTypeMap[ext] || "application/octet-stream");
  res.sendFile(requestedPath);
});

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
  // Include the request location and database error code to make backend
  // failures diagnosable without logging request bodies, tokens, or secrets.
  console.error("Server Error:", {
    method: req.method,
    path: req.originalUrl,
    code: err.code || err.name,
    message: err.message,
  });

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
