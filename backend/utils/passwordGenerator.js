const crypto = require("crypto");

function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  const pick = (chars) => chars[crypto.randomInt(chars.length)];

  const password = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (password.length < 8) password.push(pick(all));

  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

module.exports = { generateTemporaryPassword };