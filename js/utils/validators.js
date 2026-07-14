/**
 * Form validation utilities shared across the system.
 *
 * NOTE:
 * These validators only handle validation logic.
 * UI rendering and backend validation should remain separate.
 */

const Validators = {
  email(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  // Philippine mobile number format (09XXXXXXXXX)
  phone(phone) {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 11 && cleaned.startsWith("09");
  },

  // Strong password requirement for account security
  password(password) {
    const minLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    return minLength && hasUppercase && hasLowercase && hasNumber;
  },

  passwordBasic(password) {
    return password.length >= 8;
  },

  required(value) {
    return value && value.trim() !== "";
  },

  match(value1, value2) {
    return value1 === value2;
  },

  datePast(dateString) {
    return new Date(dateString) <= new Date();
  },

  // Prevent underage resident registration
  adultAge(dateString) {
    const birthDate = new Date(dateString);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDifference =
      today.getMonth() - birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() < birthDate.getDate()
      )
    ) {
      age--;
    }

    return age >= 18;
  },

  fileSize(file, maxSizeMB = 5) {
    return file.size <= maxSizeMB * 1024 * 1024;
  },

  fileType(
    file,
    allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
    ],
  ) {
    return allowedTypes.includes(file.type);
  },

  alphanumeric(value) {
    return /^[a-zA-Z0-9\s'-]+$/.test(value);
  },

  url(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Handles form-level validation and UI error rendering.
 */
class FormValidator {
  constructor(formElement) {
    this.form = formElement;
    this.errors = {};
  }

  validateField(fieldName, value, rules) {
    const errors = [];

    for (const rule of rules) {
      if (typeof rule === "string") {
        if (!Validators[rule](value)) {
          errors.push(
            this.getErrorMessage(rule, fieldName),
          );
        }
      }

      else if (typeof rule === "object") {
        if (!this.validateRule(rule, value)) {
          errors.push(
            this.getErrorMessage(
              rule.type || "invalid",
              fieldName,
            ),
          );
        }
      }
    }

    if (errors.length > 0) {
      this.errors[fieldName] = errors;
      return false;
    }

    delete this.errors[fieldName];
    return true;
  }

  validateRule(rule, value) {
    if (
      rule.custom &&
      typeof rule.custom === "function"
    ) {
      return rule.custom(value);
    }

    if (rule.min && value.length < rule.min) {
      return false;
    }

    if (rule.max && value.length > rule.max) {
      return false;
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      return false;
    }

    return true;
  }

  getErrorMessage(rule, fieldName) {
    const messages = {
      required: `${fieldName} is required`,
      email: "Please enter a valid email address",
      phone: "Please enter a valid phone number",

      password:
        "Password must contain uppercase, lowercase, and numbers",

      passwordBasic:
        "Password must be at least 8 characters",

      match: "Passwords do not match",

      datePast: "Please enter a valid date",

      adultAge: "You must be at least 18 years old",

      alphanumeric:
        `${fieldName} can only contain letters, numbers, and spaces`,

      invalid: `${fieldName} is invalid`,
    };

    return messages[rule] || `${fieldName} is invalid`;
  }

  displayErrors() {
    // Remove previous validation state before rendering new errors
    this.clearErrors();

    for (const [fieldName, messages] of Object.entries(this.errors)) {
      const input = this.form.querySelector(
        `[name="${fieldName}"]`,
      );

      if (!input) continue;

      input.classList.add("input-error");

      const errorElement = document.createElement("div");
      errorElement.className = "error-message";
      errorElement.textContent = messages[0];

      input.parentElement.appendChild(errorElement);
    }
  }

  clearErrors() {
    this.errors = {};

    this.form
      .querySelectorAll(".error-message")
      .forEach((element) => element.remove());

    this.form
      .querySelectorAll(".input-error")
      .forEach((element) => {
        element.classList.remove("input-error");
      });
  }

  validate(validationRules) {
    this.clearErrors();

    for (const [fieldName, rules] of Object.entries(validationRules)) {
      const input = this.form.querySelector(
        `[name="${fieldName}"]`,
      );

      if (!input) continue;

      const value =
        input.type === "checkbox"
          ? input.checked
          : input.value;

      this.validateField(fieldName, value, rules);
    }

    return Object.keys(this.errors).length === 0;
  }

  getFormData() {
    const formData = new FormData(this.form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    return data;
  }
}