const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/auth");

const PASSWORD_SALT_ROUNDS = 10;

const PRIVATE_ID_DIRECTORY = path.join(
  __dirname,
  "..",
  "private-uploads",
  "resident-ids",
);

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
  "superadmin@gmail.com": {
    id: "ADM-2026-001",
    email: "superadmin@gmail.com",
    role: "super_admin",
    first_name: "Jamiel",
    last_name: "Rosell",
    account_status: "active",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
  },
  "assistantadmin@gmail.com": {
    id: "ADM-2026-002",
    email: "assistantadmin@gmail.com",
    role: "assistant_admin",
    first_name: "Kiarah",
    last_name: "Beau",
    account_status: "active",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
  },
  "resident@gmail.com": {
    id: "RES-2026-003",
    email: "resident@gmail.com",
    role: "resident",
    first_name: "Aeron",
    last_name: "Smith",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      { action: "Signed in", timestamp: new Date().toISOString() },
    ],
  },
  "jam7@gmail.com": {
    id: "RES-2026-004",
    email: "jam7@gmail.com",
    role: "resident",
    first_name: "Jamaica",
    last_name: "Rosello",
    middle_name: "",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      {
        action: "Account approved and activated",
        timestamp: new Date().toISOString(),
      },
    ],
  },
  "franz@gmail.com": {
    id: "RES-2026-005",
    email: "franz@gmail.com",
    role: "resident",
    first_name: "Franz Antonette",
    last_name: "Rivera",
    middle_name: "Almohallas",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      {
        action: "Account approved and activated",
        timestamp: new Date().toISOString(),
      },
    ],
  },
  "belastanford7@gmail.com": {
    id: "RES-2026-006",
    email: "belastanford7@gmail.com",
    role: "resident",
    first_name: "Bela",
    last_name: "Stanford",
    middle_name: "Miller",
    profile_picture_url: "",
    created_at: "2026-01-01T00:00:00.000Z",
    activity_logs: [
      {
        action: "Account approved and activated",
        timestamp: new Date().toISOString(),
      },
    ],
  },
};

const demoPasswordHashes = {
  "superadmin@gmail.com": bcrypt.hashSync(
    "SuperAdmin2026!",
    PASSWORD_SALT_ROUNDS,
  ),
  "assistantadmin@gmail.com": bcrypt.hashSync(
    "AssistantAdmin2026!",
    PASSWORD_SALT_ROUNDS,
  ),
  "resident@gmail.com": bcrypt.hashSync("Resident719", PASSWORD_SALT_ROUNDS),
  "jam7@gmail.com": bcrypt.hashSync("Resident123", PASSWORD_SALT_ROUNDS),
  "franz@gmail.com": bcrypt.hashSync("Resident123", PASSWORD_SALT_ROUNDS),
  "belastanford7@gmail.com": bcrypt.hashSync(
    "Resident123",
    PASSWORD_SALT_ROUNDS,
  ),
};

const notificationsByUserId = {};

const activityLogs = [];

const complaints = [
  {
    id: "CMP-2026-0001",
    submitterId: "RES-2026-003",
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

const FALLBACK_SEED_PASSWORD_HASH = bcrypt.hashSync(
  "ChangeMe123",
  PASSWORD_SALT_ROUNDS,
);

const residentApplications = [
  {
    id: "RES-2026-003",
    firstName: "Aeron",
    lastName: "Smith",
    middleName: "",
    suffix: "",
    dateOfBirth: "2000-01-01",
    purok: "Purok Sara-Sara 1",
    contactNumber: "09170000000",
    email: "resident@gmail.com",
    validId: {
      name: "AeronID.png",
      type: "image/png",
      dataUrl: SEED_ID_IMAGES.aeron,
    },
    status: "Approved",
    archived: false,
  },
  {
    id: "RES-2026-004",
    firstName: "Jamaica",
    lastName: "Rosello",
    middleName: "",
    suffix: "",
    dateOfBirth: "2005-05-19",
    purok: "Purok Aguma-a 2",
    contactNumber: "09123456789",
    email: "jam7@gmail.com",
    validId: {
      name: "JamID.png",
      type: "image/png",
      dataUrl: SEED_ID_IMAGES.jamaica,
    },
    status: "Approved",
    archived: false,
  },
  {
    id: "RES-2026-005",
    firstName: "Franz Antonette",
    lastName: "Rivera",
    middleName: "Almohallas",
    suffix: "",
    dateOfBirth: "2005-04-11",
    purok: "Purok Danggit 1",
    contactNumber: "09817782349",
    email: "franz@gmail.com",
    validId: {
      name: "FranzID.png",
      type: "image/png",
      dataUrl: SEED_ID_IMAGES.franz,
    },
    status: "Approved",
    archived: false,
  },
  {
    id: "RES-2026-006",
    firstName: "Bela",
    lastName: "Stanford",
    middleName: "Miller",
    suffix: "",
    dateOfBirth: "1997-05-07",
    purok: "Purok Bilabid 2",
    contactNumber: "09871339927",
    email: "belastanford7@gmail.com",
    validId: {
      name: "BelaID.png",
      type: "image/png",
      dataUrl: SEED_ID_IMAGES.bela,
    },
    status: "Approved",
    archived: false,
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

function generateNextUserId() {
  const idPattern = /^RES-2026-\d{3}$/;
  const existingIds = [
    ...Object.values(demoUsersByEmail).map((u) => u.id),
    ...residentApplications.map((r) => r.id),
  ].filter((id) => idPattern.test(String(id)));
  const seq = existingIds.map((id) => Number(String(id).slice(-3)));
  return `RES-2026-${String(seq.length ? Math.max(...seq) + 1 : 1).padStart(3, "0")}`;
}

function generateNextAdminId() {
  const idPattern = /^ADM-2026-\d{3}$/;
  const ids = Object.values(demoUsersByEmail)
    .map((u) => u.id)
    .filter((id) => idPattern.test(String(id)));
  const seq = ids.map((id) => Number(String(id).slice(-3)));
  return `ADM-2026-${String(seq.length ? Math.max(...seq) + 1 : 1).padStart(3, "0")}`;
}

// Creates a Super Admin or Assistant Admin account (the only two admin
// roles in the system). New accounts start Inactive by design — Step 2
// of the turnover workflow requires an explicit activation.
function createAdministratorAccount({ firstName, lastName, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const id = generateNextAdminId();
  const admin = {
    id,
    email: normalizedEmail,
    role, // must be "super_admin" or "assistant_admin" — enforced by the caller route
    first_name: firstName,
    last_name: lastName,
    account_status: "inactive",
    profile_picture_url: "",
    created_at: new Date().toISOString(),
    activity_logs: [],
  };
  demoUsersByEmail[normalizedEmail] = admin;
  demoPasswordHashes[normalizedEmail] = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
  return admin;
}

function isEmailRegistered(email) {
  const n = normalizeEmail(email);
  return (
    Boolean(getUserByEmail(n)) ||
    residentApplications.some((r) => normalizeEmail(r.email) === n)
  );
}

function getUserByEmail(email) {
  return demoUsersByEmail[normalizeEmail(email)] || null;
}

function getUserById(id) {
  const entry = Object.entries(demoUsersByEmail).find(([, u]) => u.id === id);
  return entry ? entry[1] : null;
}

function promotePendingResidentToUser(resident) {
  const hash = resident._passwordHash || FALLBACK_SEED_PASSWORD_HASH;
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
      {
        action: "Account approved and activated",
        timestamp: new Date().toISOString(),
      },
    ],
  };
  demoUsersByEmail[user.email] = user;
  demoPasswordHashes[user.email] = hash;
  return user;
}

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
  return Object.entries(demoUsersByEmail).find(([, u]) => u.id === id);
}

function isEmailTaken(email, exceptUserId) {
  const u = getUserByEmail(email);
  return Boolean(u && u.id !== exceptUserId);
}

function verifyUserPassword(id, password) {
  const entry = getUserEntryById(id);
  if (!entry) return false;
  return Boolean(
    demoPasswordHashes[entry[0]] &&
    bcrypt.compareSync(password, demoPasswordHashes[entry[0]]),
  );
}

function updateUserPassword(id, newPassword) {
  const entry = getUserEntryById(id);
  if (!entry) return null;
  demoPasswordHashes[entry[0]] = bcrypt.hashSync(
    newPassword,
    PASSWORD_SALT_ROUNDS,
  );
  return entry[1];
}

function updateUserProfile(id, updates) {
  const entry = getUserEntryById(id);
  if (!entry) return null;
  const [key, user] = entry;
  for (const k of ["first_name", "last_name", "email", "profile_picture_url"]) {
    if (
      Object.prototype.hasOwnProperty.call(updates, k) &&
      updates[k] !== undefined
    )
      user[k] = k === "email" ? normalizeEmail(updates[k]) : updates[k];
  }
  if (user.email && user.email !== key) {
    const h = demoPasswordHashes[key];
    delete demoUsersByEmail[key];
    demoUsersByEmail[user.email] = user;
    if (h !== undefined) {
      delete demoPasswordHashes[key];
      demoPasswordHashes[user.email] = h;
    }
  }
  (user.activity_logs = user.activity_logs || []).unshift({
    action: "Profile updated",
    timestamp: new Date().toISOString(),
  });
  return user;
}

function addUserActivity(id, action, metadata = {}) {
  const user = getUserById(id);
  if (!user) return;
  (user.activity_logs = user.activity_logs || []).unshift({
    action,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
  addActivityLog({
    userId: id,
    action,
    targetType: metadata.targetType || "",
    targetId:
      metadata.targetId || metadata.complaint_id || metadata.resident_id || "",
    details: metadata.details || "",
  });
}

function addUserNotification(userId, title, message) {
  (notificationsByUserId[userId] = notificationsByUserId[userId] || []).unshift(
    {
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      created_at: new Date().toISOString(),
      is_read: false,
    },
  );
}

function removeUserById(userId) {
  const entry = getUserEntryById(userId);
  if (!entry) return null;
  const [email, user] = entry;
  delete demoUsersByEmail[email];
  delete demoPasswordHashes[email];
  delete notificationsByUserId[userId];
  return user;
}

function addUser(user, password) {
  if (!user || !user.email) return null;
  const e = user.email.toLowerCase();
  demoUsersByEmail[e] = {
    id: user.id,
    email: e,
    role: user.role || "resident",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    profile_picture_url: "",
    created_at: new Date().toISOString(),
    activity_logs: [],
  };
  if (password)
    demoPasswordHashes[e] = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
  return demoUsersByEmail[e];
}

function getActivityLogs(limit) {
  return (activityLogs || []).slice(0, limit || 200);
}

function getUserNotifications(id) {
  return notificationsByUserId[id] || (notificationsByUserId[id] = []);
}

function addAdminNotification({ title, message, roles, ...extra } = {}) {
  for (const u of Object.values(demoUsersByEmail)) {
    if ((roles || ["assistant_admin", "super_admin"]).includes(u.role)) {
      (notificationsByUserId[u.id] = notificationsByUserId[u.id] || []).unshift(
        {
          id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          message,
          created_at: new Date().toISOString(),
          is_read: false,
          ...extra,
        },
      );
    }
  }
}

function removeResidentRegistrationNotifications(residentId) {
  for (const userId of Object.keys(notificationsByUserId)) {
    const user = getUserById(userId);
    if (
      !user ||
      (user.role !== "super_admin" && user.role !== "assistant_admin")
    ) {
      continue;
    }
    notificationsByUserId[userId] = (
      notificationsByUserId[userId] || []
    ).filter((n) => {
      // Remove by exact residentId match
      if (n.type === "resident_registration" && n.residentId === residentId) {
        return false;
      }
      // Remove legacy (title-based) notifications referencing this resident
      if (
        (n.title === "New resident registration" ||
          n.title === "New resident application") &&
        n.residentId === residentId
      ) {
        return false;
      }
      return true;
    });
  }
}

function hasDuplicateRegistrationNotification(residentId) {
  for (const userId of Object.keys(notificationsByUserId)) {
    const user = getUserById(userId);
    if (
      !user ||
      (user.role !== "super_admin" && user.role !== "assistant_admin")
    ) {
      continue;
    }
    const exists = (notificationsByUserId[userId] || []).some(
      (n) => n.type === "resident_registration" && n.residentId === residentId,
    );
    if (exists) return true;
  }
  return false;
}

/**
 * cleanOrphanResidentNotifications
 *
 * Scans all administrator notification lists and removes any notification
 * whose type is "resident_registration" or whose title matches
 * "New resident registration" / "New resident application" but whose
 * residentId no longer exists in residentApplications.
 *
 * This ensures orphan notifications from testing or edge cases are
 * cleaned up automatically every time notifications are loaded.
 */
function cleanOrphanResidentNotifications() {
  const validResidentIds = new Set(residentApplications.map((r) => r.id));
  for (const userId of Object.keys(notificationsByUserId)) {
    const user = getUserById(userId);
    if (
      !user ||
      (user.role !== "super_admin" && user.role !== "assistant_admin")
    ) {
      continue;
    }
    notificationsByUserId[userId] = (
      notificationsByUserId[userId] || []
    ).filter((n) => {
      // If it's a resident registration notification type
      if (n.type === "resident_registration" && n.residentId) {
        return validResidentIds.has(n.residentId);
      }
      // Legacy title-based detection with residentId
      if (
        (n.title === "New resident registration" ||
          n.title === "New resident application") &&
        n.residentId
      ) {
        return validResidentIds.has(n.residentId);
      }
      return true;
    });
  }
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
  removeResidentRegistrationNotifications,
  hasDuplicateRegistrationNotification,
  cleanOrphanResidentNotifications,
  addUser,
  removeUserById,
  getUserNotifications,
  residentApplications,
  complaints,
  fullName,
  addActivityLog,
  getActivityLogs,
  generateNextUserId,
  promotePendingResidentToUser,
  toSafeResident,
  generateNextAdminId,
  createAdministratorAccount,
};
