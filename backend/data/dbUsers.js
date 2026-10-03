const bcrypt = require("bcryptjs");
const db = require("../db");

const PASSWORD_SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function dbUserToApi(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    first_name: row.first_name,
    middle_name: row.middle_name || "",
    last_name: row.last_name,
    suffix: row.suffix || "",
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : "",
    purok: row.purok || "",
    contactNumber: row.contact_number || "",
    profile_picture_url: row.profile_picture_url || "",
    account_status: row.account_status,
    email_verified_at: row.email_verified_at,
    pending_email: row.pending_email || "",
    status: row.application_status,
    archived: Boolean(row.is_archived),
    is_archived: Boolean(row.is_archived),
    archivedAt: row.archived_at,
    created_at: row.created_at,
    validId: row.valid_id_name
      ? {
          name: row.valid_id_name,
          type: row.valid_id_type || "",
          dataUrl: row.valid_id_data || "",
        }
      : null,
  };
}

async function getDbUserByEmail(email) {
  const [rows] = await db.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  );
  return dbUserToApi(rows[0]);
}

async function getDbUserWithPasswordByEmail(email) {
  const [rows] = await db.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  );
  return rows[0] || null;
}

async function getDbUserById(id) {
  const [rows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
    id,
  ]);
  return dbUserToApi(rows[0]);
}

async function verifyDbUserPassword(id, password) {
  const [rows] = await db.query(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [id],
  );
  return Boolean(
    rows[0]?.password_hash &&
      bcrypt.compareSync(String(password || ""), rows[0].password_hash),
  );
}

async function updateDbUserPassword(id, newPassword) {
  const passwordHash = bcrypt.hashSync(newPassword, PASSWORD_SALT_ROUNDS);
  await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [
    passwordHash,
    id,
  ]);
  return getDbUserById(id);
}

async function markDbUserEmailVerified(id) {
  await db.query(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?",
    [id],
  );
  return getDbUserById(id);
}

async function promoteDbPendingEmail(id) {
  await db.query(
    `
      UPDATE users
      SET email = pending_email,
          pending_email = NULL,
          email_verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND pending_email IS NOT NULL
    `,
    [id],
  );
  return getDbUserById(id);
}

async function isDbEmailRegistered(email, exceptUserId = "") {
  const params = [normalizeEmail(email)];
  let sql = "SELECT id FROM users WHERE email = ? OR pending_email = ?";
  params.push(normalizeEmail(email));
  if (exceptUserId) {
    sql = `SELECT id FROM users WHERE (email = ? OR pending_email = ?) AND id <> ?`;
    params.push(exceptUserId);
  }
  sql += " LIMIT 1";
  const [rows] = await db.query(sql, params);
  return rows.length > 0;
}

async function generateNextDbUserId(prefix) {
  const [rows] = await db.query(
    "SELECT id FROM users WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
    [`${prefix}-2026-%`],
  );
  const last = rows[0]?.id || `${prefix}-2026-000`;
  const next = Number(String(last).slice(-3)) + 1;
  return `${prefix}-2026-${String(next).padStart(3, "0")}`;
}

async function createDbResidentApplication(resident, passwordHash) {
  await db.query(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        first_name,
        middle_name,
        last_name,
        suffix,
        date_of_birth,
        purok,
        contact_number,
        valid_id_name,
        valid_id_type,
        valid_id_data,
        application_status,
        is_archived,
        account_status
      ) VALUES (
        ?, ?, ?, 'resident', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', FALSE, 'inactive'
      )
    `,
    [
      resident.id,
      normalizeEmail(resident.email),
      passwordHash,
      resident.firstName,
      resident.middleName,
      resident.lastName,
      resident.suffix,
      resident.dateOfBirth,
      resident.purok,
      resident.contactNumber,
      resident.validId?.name || null,
      resident.validId?.type || null,
      resident.validId?.dataUrl || null,
    ],
  );

  return getDbUserById(resident.id);
}

async function createDbAdmin({ firstName, lastName, email, passwordHash, role }) {
  const id = await generateNextDbUserId("ADM");
  await db.query(
    `
      INSERT INTO users (
        id, email, password_hash, role, first_name, last_name,
        application_status, account_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Approved', 'inactive')
    `,
    [id, normalizeEmail(email), passwordHash, role, firstName, lastName],
  );
  return getDbUserById(id);
}

async function deleteDbUserById(id) {
  await db.query("DELETE FROM users WHERE id = ?", [id]);
}

async function updateDbProfile(id, updates) {
  await db.query(
    "UPDATE users SET profile_picture_url = ? WHERE id = ?",
    [updates.profile_picture_url || "", id],
  );
  return getDbUserById(id);
}

async function setDbPendingEmail(id, email) {
  await db.query("UPDATE users SET pending_email = ? WHERE id = ?", [
    normalizeEmail(email),
    id,
  ]);
  return getDbUserById(id);
}

async function activateDbAdminWithPassword(id, newPassword) {
  const passwordHash = bcrypt.hashSync(newPassword, PASSWORD_SALT_ROUNDS);
  await db.query(
    `
      UPDATE users
      SET password_hash = ?,
          account_status = 'active',
          email_verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND role IN ('assistant_admin', 'super_admin')
    `,
    [passwordHash, id],
  );
  return getDbUserById(id);
}

module.exports = {
  normalizeEmail,
  dbUserToApi,
  getDbUserByEmail,
  getDbUserWithPasswordByEmail,
  getDbUserById,
  verifyDbUserPassword,
  updateDbUserPassword,
  markDbUserEmailVerified,
  promoteDbPendingEmail,
  isDbEmailRegistered,
  generateNextDbUserId,
  createDbResidentApplication,
  createDbAdmin,
  deleteDbUserById,
  updateDbProfile,
  setDbPendingEmail,
  activateDbAdminWithPassword,
};
