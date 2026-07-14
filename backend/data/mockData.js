const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/auth");

const PASSWORD_SALT_ROUNDS = 10;

const PRIVATE_ID_DIRECTORY = path.join(__dirname, "..", "private-uploads", "resident-ids");

function loadSeedIdImage(fileName) {
  const filePath = path.join(PRIVATE_ID_DIRECTORY, fileName);
  try {
    return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch (error) {
    console.warn(`Seed ID image could not be loaded: ${fileName}`);
    return "";
  }
}

const SEED_ID_IMAGES = {
  aeron: loadSeedIdImage("AeronID.png"),
  jamaica: loadSeedIdImage("JamID.png"),
  franz: loadSeedIdImage("FranzID.png"),
  bela: loadSeedIdImage("BelaID.png"),
};

const demoUsersByEmail = {
  "admin@gmail.com": {
    id: "2026001",
    email: "admin@gmail.com",
    role: "super_admin",
    first_name: "Jamiel",
    last_name: "Rosell",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
  "secretary@gmail.com": {
    id: "2026002",
    email: "secretary@gmail.com",
    role: "assistant_admin",
    first_name: "Kiarah",
    last_name: "Beau",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
  "resident@gmail.com": {
    id: "2026003",
    email: "resident@gmail.com",
    role: "resident",
    first_name: "Aeron",
    last_name: "Smith",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
  "jam7@gmail.com": {
    id: "2026004",
    email: "jam7@gmail.com",
    role: "resident",
    first_name: "Jamaica",
    last_name: "Rosello",
    middle_name: "",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Account approved and activated", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
  "franz@gmail.com": {
    id: "2026005",
    email: "franz@gmail.com",
    role: "resident",
    first_name: "Franz Antonette",
    last_name: "Rivera",
    middle_name: "Almohallas",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Account approved and activated", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
  "belastanford7@gmail.com": {
    id: "2026006",
    email: "belastanford7@gmail.com",
    role: "resident",
    first_name: "Bela",
    last_name: "Stanford",
    middle_name: "Miller",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Account approved and activated", timestamp: new Date().toISOString() },
    ],
    warning_count: 0,
    is_restricted: false,
    restricted_until: null,
  },
};

const demoPasswordHashes = {
  "admin@gmail.com": bcrypt.hashSync("admin578", PASSWORD_SALT_ROUNDS),
  "secretary@gmail.com": bcrypt.hashSync("secretary123", PASSWORD_SALT_ROUNDS),
  "resident@gmail.com": bcrypt.hashSync("Resident719", PASSWORD_SALT_ROUNDS),
  // Demo password for the 3 pre-approved seed residents below.
  // Change or share with them as needed — it's the same for all three
  // for simplicity; each has their own account/email.
  "jam7@gmail.com": bcrypt.hashSync("Resident123", PASSWORD_SALT_ROUNDS),
  "franz@gmail.com": bcrypt.hashSync("Resident123", PASSWORD_SALT_ROUNDS),
  "belastanford7@gmail.com": bcrypt.hashSync("Resident123", PASSWORD_SALT_ROUNDS),
};

const notificationsByUserId = {
  2026001: [
    {
      id: "ntf-admin-1",
      title: "New resident application",
      message: "A new resident account is waiting for approval.",
      created_at: new Date().toISOString(),
      is_read: false,
    },
    {
      id: "ntf-admin-2",
      title: "Complaint report filed",
      message: "A new complaint was submitted and is pending review.",
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      is_read: true,
    },
  ],
  2026002: [
    {
      id: "ntf-assistant-1",
      title: "Weekly permit reminder",
      message: "Remember to complete the weekly review of active case files.",
      created_at: new Date().toISOString(),
      is_read: false,
    },
  ],
  2026003: [
    {
      id: "ntf-resident-1",
      title: "Complaint received",
      message: "Your complaint has been received by the barangay office.",
      created_at: new Date().toISOString(),
      is_read: false,
    },
  ],
};

const activityLogs = [];

const complaints = [
  {
    id: "CMP-2026-0001",
    submitterId: "2026003",
    title: "Loud music past midnight",
    category: "Noise and Public Disturbance",
    purok: "Purok Sara-Sara 1",
    incidentDate: "2026-07-11",
    incidentTime: "4:30 PM",
    details: "Loud music played repeatedly past midnight.",
    status: "in-progress",
    priority: "High",
    confidential: "Yes",
    source: "In-person at Barangay Office",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
];

const residentWarnings = [];

const WARNING_TYPES = {
  duplicate: "duplicate_submission",
  restriction: "restriction_applied",
};

// ---------------------------------------------------------------
// Pending resident applications.
//
// This is now the ONLY place a registration lands before approval.
// POST /api/auth/register pushes here (status "Pending"); approving
// a resident promotes the entry into demoUsersByEmail via
// promotePendingResidentToUser() below, carrying over the password
// hash that was set at registration time so the resident can sign in
// immediately after approval.
//
// The two seed entries below (Liza, Mark) predate the password-hash
// field, so a fallback demo password is used if you approve them
// without registration having set one. See promotePendingResidentToUser.
// ---------------------------------------------------------------

const FALLBACK_SEED_PASSWORD_HASH = bcrypt.hashSync(
  "ChangeMe123",
  PASSWORD_SALT_ROUNDS,
);

const residentApplications = [
  {
    id: "2026003",
    firstName: "Aeron",
    lastName: "Smith",
    middleName: "",
    suffix: "",
    dateOfBirth: "2000-01-01",
    purok: "Purok Sara-Sara 1",
    contactNumber: "09170000000",
    email: "resident@gmail.com",
    validId: { name: "AeronID.png", type: "image/png", dataUrl: SEED_ID_IMAGES.aeron },
    status: "Approved",
    archived: false,
    warning_count: 0,
    is_restricted: false,
  },
  {
    id: "2026004",
    firstName: "Jamaica",
    lastName: "Rosello",
    middleName: "",
    suffix: "",
    dateOfBirth: "2005-05-19",
    purok: "Purok Aguma-a 2",
    contactNumber: "09123456789",
    email: "jam7@gmail.com",
    validId: { name: "JamID.png", type: "image/png", dataUrl: SEED_ID_IMAGES.jamaica },
    status: "Approved",
    archived: false,
    warning_count: 0,
    is_restricted: false,
  },
  {
    id: "2026005",
    firstName: "Franz Antonette",
    lastName: "Rivera",
    middleName: "Almohallas",
    suffix: "",
    dateOfBirth: "2005-04-11",
    purok: "Purok Danggit 1",
    contactNumber: "09817782349",
    email: "franz@gmail.com",
    validId: { name: "FranzID.png", type: "image/png", dataUrl: SEED_ID_IMAGES.franz },
    status: "Approved",
    archived: false,
    warning_count: 0,
    is_restricted: false,
  },
  {
    id: "2026006",
    firstName: "Bela",
    lastName: "Stanford",
    middleName: "Miller",
    suffix: "",
    dateOfBirth: "1997-05-07",
    purok: "Purok Bilabid 2",
    contactNumber: "09871339927",
    email: "belastanford7@gmail.com",
    validId: { name: "BelaID.png", type: "image/png", dataUrl: SEED_ID_IMAGES.bela },
    status: "Approved",
    archived: false,
    warning_count: 0,
    is_restricted: false,
  },
];

function fullName(user) {
  if (!user) return "Unknown Resident";
  return [user.first_name, user.middle_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function addActivityLog({
  userId = null,
  userName = "",
  action,
  targetType = "",
  targetId = "",
  details = "",
} = {}) {
  const user = userId ? getUserById(userId) : null;
  const entry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    user: userName || fullName(user) || "System",
    action: action || "Recorded activity",
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  };

  activityLogs.unshift(entry);
  return entry;
}

// ---------------------------------------------------------------
// Shared ID generation.
//
// Looks at BOTH demoUsersByEmail (admin/secretary/Aeron = 001-003)
// AND residentApplications (every past registrant, pending or not)
// so there is exactly one counter, server-side, for the whole app.
// Replaces the old duplicated logic that used to live independently
// in sign_up.js (client) and auth.js (server, fallbackUserSequence).
// ---------------------------------------------------------------

function generateNextUserId() {
  const idPattern = /^2026\d{3}$/;

  const existingIds = [
    ...Object.values(demoUsersByEmail).map((user) => user.id),
    ...residentApplications.map((resident) => resident.id),
  ].filter((id) => idPattern.test(String(id)));

  const sequences = existingIds.map((id) => Number(String(id).slice(4)));
  const nextSequence = sequences.length ? Math.max(...sequences) + 1 : 1;

  return `2026${String(nextSequence).padStart(3, "0")}`;
}

function isEmailRegistered(email) {
  const normalized = normalizeEmail(email);
  const isExistingUser = Boolean(getUserByEmail(normalized));
  const isExistingApplicant = residentApplications.some(
    (resident) => normalizeEmail(resident.email) === normalized,
  );
  return isExistingUser || isExistingApplicant;
}

// Promotes an approved resident application into a real, loggable-in
// user. Uses the password hash captured at registration time; falls
// back to a known demo password only for legacy seed entries that
// predate that field (Liza, Mark).
function promotePendingResidentToUser(resident) {
  const passwordHash = resident._passwordHash || FALLBACK_SEED_PASSWORD_HASH;

  const user = {
    id: resident.id,
    email: normalizeEmail(resident.email),
    role: "resident",
    first_name: resident.firstName,
    last_name: resident.lastName,
    middle_name: resident.middleName || null,
    profile_picture_url: "",
    created_at: new Date().toISOString(),
    activity_logs: [
      { action: "Account approved and activated", timestamp: new Date().toISOString() },
    ],
    warning_count: resident.warning_count || 0,
    is_restricted: false,
    restricted_until: null,
  };

  demoUsersByEmail[user.email] = user;
  demoPasswordHashes[user.email] = passwordHash;

  return user;
}

// Strips internal-only fields (like the password hash) before a
// resident application record is sent to the frontend.
function toSafeResident(resident) {
  const { _passwordHash, ...safe } = resident;
  return safe;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getUserEntryById(id) {
  return Object.entries(demoUsersByEmail).find(([, user]) => user.id === id);
}

function getUserByEmail(email) {
  return demoUsersByEmail[normalizeEmail(email)] || null;
}

function getUserById(id) {
  const entry = getUserEntryById(id);
  return entry ? entry[1] : null;
}

function updateUserProfile(id, updates) {
  const entry = getUserEntryById(id);
  if (!entry) {
    return null;
  }

  const [currentEmailKey, user] = entry;
  const allowed = ["first_name", "last_name", "email", "profile_picture_url"];

  allowed.forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(updates, key) &&
      updates[key] !== undefined
    ) {
      user[key] = key === "email" ? normalizeEmail(updates[key]) : updates[key];
    }
  });

  if (user.email && user.email !== currentEmailKey) {
    const passwordHash = demoPasswordHashes[currentEmailKey];
    delete demoUsersByEmail[currentEmailKey];
    demoUsersByEmail[user.email] = user;

    if (passwordHash !== undefined) {
      delete demoPasswordHashes[currentEmailKey];
      demoPasswordHashes[user.email] = passwordHash;
    }
  }

  user.activity_logs = user.activity_logs || [];
  user.activity_logs.unshift({
    action: "Profile updated",
    timestamp: new Date().toISOString(),
  });

  return user;
}

function isEmailTaken(email, exceptUserId = null) {
  const user = getUserByEmail(email);
  return Boolean(user && user.id !== exceptUserId);
}

function verifyUserPassword(id, password) {
  const entry = getUserEntryById(id);
  if (!entry) return false;

  const [email] = entry;
  const passwordHash = demoPasswordHashes[email];
  return Boolean(passwordHash && bcrypt.compareSync(password, passwordHash));
}

function updateUserPassword(id, newPassword) {
  const entry = getUserEntryById(id);
  if (!entry) return null;

  const [email, user] = entry;
  demoPasswordHashes[email] = bcrypt.hashSync(
    newPassword,
    PASSWORD_SALT_ROUNDS,
  );
  return user;
}

function addUserActivity(id, action, metadata = {}) {
  const user = getUserById(id);
  if (!user) return;
  user.activity_logs = user.activity_logs || [];
  const entry = {
    action,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
  user.activity_logs.unshift(entry);
  addActivityLog({
    userId: id,
    action,
    targetType: metadata.targetType || metadata.target_type || "",
    targetId:
      metadata.targetId ||
      metadata.target_id ||
      metadata.complaint_id ||
      metadata.resident_id ||
      "",
    details: metadata.details || "",
  });
}

function addUserNotification(userId, title, message) {
  if (!notificationsByUserId[userId]) {
    notificationsByUserId[userId] = [];
  }
  notificationsByUserId[userId].unshift({
    id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    message,
    created_at: new Date().toISOString(),
    is_read: false,
  });
}

function removeUserById(userId) {
  const entry = Object.entries(demoUsersByEmail).find(
    ([, user]) => user.id === userId,
  );
  if (!entry) {
    return null;
  }

  const [email, user] = entry;
  delete demoUsersByEmail[email];
  delete demoPasswordHashes[email];
  delete notificationsByUserId[userId];
  return user;
}

// Retained for any other caller that still adds a user directly with a
// plaintext password (e.g. seeding/testing). Registration and approval
// now use promotePendingResidentToUser() instead, which preserves the
// hash set at registration time rather than re-hashing an empty string.
function addUser(user, password = "") {
  if (!user || !user.email) {
    return null;
  }

  const normalizedEmail = user.email.toLowerCase();
  demoUsersByEmail[normalizedEmail] = {
    id: user.id,
    email: normalizedEmail,
    role: user.role || "resident",
    first_name: user.first_name || user.firstName || "",
    last_name: user.last_name || user.lastName || "",
    profile_picture_url: user.profile_picture_url || "",
    created_at: user.created_at || new Date().toISOString(),
    activity_logs: user.activity_logs || [],
    warning_count: user.warning_count || 0,
    is_restricted: Boolean(user.is_restricted),
    restricted_until: user.restricted_until || null,
  };

  if (password) {
    demoPasswordHashes[normalizedEmail] = bcrypt.hashSync(
      password,
      PASSWORD_SALT_ROUNDS,
    );
  }

  return demoUsersByEmail[normalizedEmail];
}

function getActivityLogs(limit = 200) {
  return activityLogs.slice(0, limit);
}

function getUserNotifications(id) {
  if (!notificationsByUserId[id]) {
    notificationsByUserId[id] = [];
  }
  return notificationsByUserId[id];
}

function addAdminNotification({
  title,
  message,
  roles = ["assistant_admin", "super_admin"],
}) {
  Object.values(demoUsersByEmail).forEach((user) => {
    if (roles.includes(user.role)) {
      if (!notificationsByUserId[user.id]) {
        notificationsByUserId[user.id] = [];
      }
      notificationsByUserId[user.id].unshift({
        id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        message,
        created_at: new Date().toISOString(),
        is_read: false,
      });
    }
  });
}

function getUserWarnings(userId) {
  return residentWarnings.filter((warning) => warning.residentId === userId);
}

function logResidentWarning({
  residentId,
  complaintId,
  type,
  reason,
  expiresAt = null,
}) {
  const warning = {
    id: `warning-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    residentId,
    complaintId,
    type,
    reason,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };

  residentWarnings.push(warning);

  const user = getUserById(residentId);
  if (user) {
    user.warning_count = (user.warning_count || 0) + 1;
    if (expiresAt) {
      user.is_restricted = true;
      user.restricted_until = expiresAt;
    }
  }

  return warning;
}

function clearUserRestriction(userId) {
  const user = getUserById(userId);
  if (!user) return null;

  user.is_restricted = false;
  user.restricted_until = null;
  return user;
}

module.exports = {
  demoPasswordHashes,
  demoUsersByEmail,
  signToken,
  verifyToken,
  getUserByEmail,
  getUserById,
  isEmailTaken,
  isEmailRegistered,
  verifyUserPassword,
  updateUserPassword,
  updateUserProfile,
  addUserActivity,
  addUserNotification,
  addAdminNotification,
  addUser,
  removeUserById,
  getUserNotifications,
  residentApplications,
  complaints,
  residentWarnings,
  getUserWarnings,
  logResidentWarning,
  clearUserRestriction,
  fullName,
  addActivityLog,
  getActivityLogs,
  generateNextUserId,
  promotePendingResidentToUser,
  toSafeResident,
};
