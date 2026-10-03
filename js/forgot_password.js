document.addEventListener("DOMContentLoaded", () => {
  const requestForm = document.getElementById("requestResetForm");
  const resetForm = document.getElementById("resetPasswordForm");
  const emailInput = document.getElementById("email");
  const requestStatusMessage = document.getElementById("requestStatusMessage");
  const introText = document.getElementById("introText");
  const newPassword = document.getElementById("newPassword");
  const confirmNewPassword = document.getElementById("confirmNewPassword");
  const modal = document.getElementById("successModal");
  const requestResetBtn = document.getElementById("requestResetBtn");
  const resetPasswordBtn = document.getElementById("resetPasswordBtn");

  // Password visibility toggles for the "set new password" fields
  [
    { btn: document.getElementById("toggleNewPassword"), input: newPassword },
    { btn: document.getElementById("toggleConfirmNewPassword"), input: confirmNewPassword },
  ].forEach(({ btn, input }) => {
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.classList.toggle("closed", !isHidden);
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // MODE B: a reset link was clicked — validate the token first
  async function enterResetPasswordMode() {
    requestForm.hidden = true;
    resetForm.hidden = false;
    introText.textContent = "Verifying your reset link…";

    try {
      const response = await fetch("/api/auth/validate-reset-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Invalid/expired/used token — fall back to requesting a new link
        resetForm.hidden = true;
        requestForm.hidden = false;
        introText.textContent =
          data.message ||
          "This reset link is invalid or has expired. Please request a new one below.";
        showNotification(introText.textContent, "error");
        return;
      }

      introText.textContent = "Enter a new password for your account.";
    } catch (err) {
      resetForm.hidden = true;
      requestForm.hidden = false;
      introText.textContent =
        "Unable to verify your reset link right now. Please request a new one below.";
      showNotification("Server error. Please try again.", "error");
    }
  }

  if (token) {
    enterResetPasswordMode();
  }

  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!Validators.email(email)) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }

    setButtonLoading(requestResetBtn, true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to send the password reset email. Please try again later.",
        );
      }

      // Backend intentionally always returns a generic message here
      // (email-enumeration protection) — never branch on account existence.
      requestStatusMessage.textContent =
        data.message ||
        "If an account is associated with this email address, we will send instructions to reset your password.";
      showNotification(requestStatusMessage.textContent, "success", 5000);
      requestForm.reset();
    } catch (err) {
      showNotification(
        err.message || "Unable to send the password reset email. Please try again later.",
        "error",
      );
    } finally {
      setButtonLoading(requestResetBtn, false);
    }
  });

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = newPassword.value;
    const confirmPassword = confirmNewPassword.value;

    if (!password || !confirmPassword) {
      showNotification("Please fill in both password fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    if (!Validators.password(password)) {
      showNotification(
        "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.",
        "error",
      );
      return;
    }

    setButtonLoading(resetPasswordBtn, true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: password,
          confirmPassword,
        }),
      });
      const data = await response.json();

      if (data.success) {
        modal.classList.add("show");
      } else {
        showNotification(data.message || "Reset failed. Please try again.", "error");
      }
    } catch (err) {
      showNotification("Server error. Please try again.", "error");
    } finally {
      setButtonLoading(resetPasswordBtn, false);
    }
  });
});
