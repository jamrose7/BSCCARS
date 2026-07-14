const JWT_SECRET = process.env.JWT_SECRET || "bsccars_jwt_secret_2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
