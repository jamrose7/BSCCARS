const crypto = require("crypto");
const db = require("../db");

const TOKEN_BYTES = 32;
const TOKEN_TYPES = new Set([
  "email_verification",
  "password_reset",
  "admin_activation",
  "email_change",
]);

function createRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""), "utf8")
    .digest("hex");
}

function tokenExpiresAt(minutes) {
  const ttl = Number.parseInt(minutes, 10);
  const safeTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : 30;
  return new Date(Date.now() + safeTtl * 60 * 1000);
}

async function createAuthToken(userId, tokenType, ttlMinutes) {
  if (!TOKEN_TYPES.has(tokenType)) {
    throw new Error("Unsupported token type.");
  }

  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = tokenExpiresAt(ttlMinutes);

  await db.query(
    `
      INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at)
      VALUES (?, ?, ?, ?)
    `,
    [userId, tokenHash, tokenType, expiresAt],
  );

  return { rawToken, expiresAt };
}

async function findAuthToken(rawToken, tokenType) {
  if (!TOKEN_TYPES.has(tokenType)) {
    return null;
  }

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const [rows] = await db.query(
    `
      SELECT at.*, u.email, u.role, u.first_name, u.last_name,
             u.account_status, u.application_status, u.email_verified_at
      FROM auth_tokens at
      INNER JOIN users u ON u.id = at.user_id
      WHERE at.token_hash = ?
        AND at.token_type = ?
      LIMIT 1
    `,
    [tokenHash, tokenType],
  );

  return rows[0] || null;
}

async function markAuthTokenUsed(id) {
  await db.query(
    `
      UPDATE auth_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND used_at IS NULL
    `,
    [id],
  );
}

async function invalidateOutstandingTokens(userId, tokenType) {
  if (!TOKEN_TYPES.has(tokenType)) {
    throw new Error("Unsupported token type.");
  }

  await db.query(
    `
      UPDATE auth_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND token_type = ?
        AND used_at IS NULL
    `,
    [userId, tokenType],
  );
}

function getTokenStatus(row) {
  if (!row) return "invalid";
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "valid";
}

module.exports = {
  createAuthToken,
  findAuthToken,
  markAuthTokenUsed,
  invalidateOutstandingTokens,
  hashToken,
  getTokenStatus,
};
