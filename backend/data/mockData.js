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
    title: "Loud music at night",
    category: "Noise and Public Disturbance",
    purok: "Purok Sara-Sara 1",
    incidentDate: "2026-07-11",
    incidentTime: "00:30",
    details: "Nabantayan nakon nga kusog kaayo ang music gikan sa usa ka byay sa among area sa Purok Sara-Sara 1. Nagsugod na ug saba ang music pagkagabii ug nagpadayon gihapon bisan lapas na sa tungang gabii. Lisod na kaayo makapahuway ug makatulog tungod sa kusog nga music, labi na para sa mga nagpuyo duol sa among lugar. Nabalaka pud ko kay basin magpadayon ni nga problema kung dili maistoryahan ang mga involved. Unta ma-check sa barangay ang situation ug matabangan nga mahinay-hinayan ang volume sa music labi na kung gabii na.",
    status: "in-progress",
    priority: "Normal",
    confidential: "Yes",
    source: "Digital Submission",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
  {
    id: "CMP-2026-0002",
    submitterId: "RES-2026-004",
    title: "Garbage dumped along the roadside",
    category: "Waste, Sanitation, and Environment",
    purok: "Purok Bilabid 2",
    incidentDate: "2026-07-14",
    incidentTime: "09:15",
    details: "Nabantayan nakon nga aray mga basura ug household waste nga gipangtambak sa kilid sang dahan diri sa among area sa Purok Bilabid 2. Pipila na ka adlaw nga ara ang mga basura and nagsugod na ang baho, labi na kung init ang panahon. Nabalaka ko kay basin makadani sang mga langaw, iro, iring, and iban pa na mga sapat. Dili na lat maayo tan-awon and dili komportable para sa mga nagpuyo sa lapit and ang mga nangagi sa lugar. Unta ma-check sa barangay ang area ug matabangan nga makolekta ug ma-dispose sang tarong ang mga basura.",
    status: "pending",
    priority: "Normal",
    confidential: "Yes",
    source: "In-person at Barangay Office",
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
  {
    id: "CMP-2026-0003",
    submitterId: "RES-2026-005",
    title: "Blocked drainage causing flooding",
    category: "Road and Infrastructure",
    purok: "Purok Aguma-a 2",
    incidentDate: "2026-07-15",
    incidentTime: "18:45",
    details: "Nabantayan nakon nga dali da kaayo magpundok ang tubig sa kilid sang dahan sa Purok Aguma-a 2 kung mag-uwan. Murag barado ang drainage amo nga dili tarong ang pag-agas sang tubig ug magsugod na ug overflow paduhong sa dahan. Tungod sini, lisod na agian ang area labi na kung kusog ang uwan, ug nabalaka pud ko kay basin mosamot ang problema kung sige ni nga mahitabo. Unta ma-check sa barangay ang drainage ug malimpyohan o ma-repair kung kinahanglan aron dili na magtapok ang tubig kada mag-uwan.",
    status: "in-progress",
    priority: "Normal",
    confidential: "Yes",
    source: "Digital Submission",
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
  {
    id: "CMP-2026-0004",
    submitterId: "RES-2026-006",
    title: "Borrowed money has not been paid back",
    category: "Money Debt",
    purok: "Purok Bilabid 3",
    respondentName: "Liam Nazar",
    respondentContactNumber: "09123456789",
    respondentPurok: "Purok Bilabid 3",
    incidentDate: "2026-07-16",
    incidentTime: "13:20",
    details:
    "Nanghulam si Liam Nazar sa akon sang 10, 000 para gamiton sa iyang medical expenses. Sa among sabot, bayaran unta niya ang kwarta pagkahuman sa iyang kinahanglanon, pero hangtod karon wala pa gihapon niya nabayran ang tibuok kantidad. Nakig-coordinate na ko niya ug naka-follow up na pud ko pila ka beses bahin sa iyang utang, pero wala pa gihapon nahuman ang pagbayad. Nasabtan nako nga basin naa gihapon siyay personal nga problema, mao nga gusto nako nga masulbad ni pinaagi sa maayong pag-istorya ug dili pinaagi sa panaglalis. Nangayo ko og tabang sa barangay aron maistoryahan namo ang among concern ug makasabot mi sa angay nga paagi sa pag-settle sa 10, 000 nga utang.",
    status: "in-progress",
    priority: "Normal",
    confidential: "Yes",
    source: "Digital Submission",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
   {
    id: "CMP-2026-0005",
    submitterId: "RES-2026-003",
    title: "Aray patay nga sapat lapit sa among lugar",
    category: "Public Health Hazard",
    purok: "Purok Pugapo",
    incidentDate: "2026-07-17",
    incidentTime: "07:00",
    details:
      "Nabantayan nakon sara nga aga nga aray patay nga sapat nga nahimutang lapit sa among residential area sa Purok Pugapo. Ara na kini didto sukad nga akong nakita ug nagsugod na pud ug dili maayo nga baho. Nabalaka ko kay duol ra kini sa mga balay ug basin makadani ug mga langaw, iro, iring, ug uban pa nga sapat. Basin lat mahimong problema sa kalimpyo ug panglawas sa mga nagpuyo lapit sa lugar kung dugay pa kini dili makuha. Unta ma-check dayon sa barangay ang area ug matabangan nga makuha and ma-dispose sang tarong ang patay nga sapat.",
    status: "resolved",
    priority: "High",
    confidential: "Yes",
    source: "Digital Submission",
    createdAt: new Date(
      Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],

    adminResponse:
      "Na-check na sa barangay ang lugar ug nakit-an ang patay nga sapat. Na-coordinate na ang pagkuha ug proper disposal niini. Gi-check usab ang palibot aron masiguro nga limpyo ug walay nahabiling problema.",

    internalNotes: [
      {
        role: "Barangay Tanod",
        assignedPersonnel: "Pedro Santos",
        fieldTask:
          "Check the reported location and coordinate the removal of the dead animal.",
        note:
          "Na-check ang area sa Purok Pugapo ug gi-coordinate ang pagkuha ug proper disposal sa patay nga sapat.",
      },
    ],
  },
  {
    id: "CMP-2026-0006",
    submitterId: "RES-2026-004",
    title: "Naay kahina-hinalang lihok duol sa barangay hall",
    category: "Illegal or Criminal Activity",
    purok: "Purok Sap-Sap 2",
    incidentDate: "2026-07-18",
    incidentTime: "23:10",
    details: "Nabantayan nakon kagabii nga aray mga tawo nga naglihok-lihok duol sa barangay hall sa Purok Sap-Sap 2. Medyo kahina-hinala ilang lihok kay sige sila og balik-balik sa area ug murag nagtan-aw sa mga butang nga naa sa palibot. Nakabantay pud ko nga adunay mga gamit nga wala na sa ilang naandan nga lugar, mao nga nabalaka ko nga basin adunay nanghilabot o nangkuha niini nga walay permiso. Dili ko sigurado kung kinsa ang involved o unsa gyud ilang tuyo, mao nga dili ko gusto nga maghimo ug sayop nga akusasyon. Nangayo ko og tabang sa barangay aron ma-check ang area ug mahibal-an kung adunay nahitabo nga paglapas o pagpanghilabot sa property.",
    status: "pending",
    priority: "Normal",
    confidential: "Yes",
    source: "Digital Submission",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    archived: false,
    is_archived: false,
    attachments: [],
    comments: [],
  },
  {
  id: "CMP-2026-0007",
  submitterId: "RES-2026-005",
  title: "Gihadlok ko sa akong silingan",
  category: "Physical Harm, Violence, or Threats",
  purok: "Purok Tulingan",
  incidentDate: "2026-07-19",
  incidentTime: "20:30",
  details:
    "Gusto nakon i-report ang nahitabo sa akon ug sa akong silingan sa Purok Tulingan. Kagabii, gihadlok ko niya samtang naglalis mi ug nahadlok ko nga basin mas grabe pa ang among problema. Sukad ato, dili na ko komportable nga mag-inusara duol sa among lugar kay nahadlok ko para sa akong safety. Dili nako gusto nga mosamot pa ni nga problema, mao nga niadto ko sa barangay office para mangayo ug tabang. Unta matabangan ko sa barangay nga masulbad ni nga problema ug dili na mausab ang nahitabo.",
  status: "resolved",
  priority: "High",
  confidential: "Yes",
  source: "In-person at Barangay Office",
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  resolvedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  archived: false,
  is_archived: false,
  attachments: [],
  comments: [],

  adminResponse:
    "Na-receive ug na-assess na sa barangay ang report. Na-coordinate na ang concern ngadto sa angay nga barangay personnel aron ma-monitor ang sitwasyon ug matabangan ang mga involved nga masulbad ang concern sa hapsay ug luwas nga paagi.",

  internalNotes: [
    {
      role: "Barangay Tanod",
      assignedPersonnel: "Ramon Dela Cruz",
      fieldTask:
        "Coordinate with the concerned parties and monitor the reported area.",
      note:
        "Na-coordinate ang concern sa barangay personnel ug na-monitor ang reported area. Gi-remind ang mga involved nga sulbaron ang concern pinaagi sa hapsay nga pag-istorya ug barangay assistance.",
    },
  ],
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

// Creates a Super Admin or Assistant Admin account.
// New accounts start Inactive and require explicit activation.
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
