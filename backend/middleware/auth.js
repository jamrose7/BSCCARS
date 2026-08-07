const jwt = require("jsonwebtoken");
const { getUserById } = require("../data/mockData");
const { JWT_SECRET } = require("../config/auth");
const VALID_ROLES = new Set(["super_admin", "assistant_admin", "resident"]);

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token missing or invalid.",
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.account_status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "This account is inactive. Contact the Barangay Office for assistance.",
      });
    }

    if (!VALID_ROLES.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account has an unsupported role.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles,
  VALID_ROLES,
};
