const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number and a special character.";

function isStrongEnoughPassword(password) {
  if (typeof password !== "string" || password.length < 8) return false;

  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  );
}

module.exports = {
  PASSWORD_POLICY_MESSAGE,
  isStrongEnoughPassword,
};
