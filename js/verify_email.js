document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("verifyStatus");
  const resendForm = document.getElementById("resendVerificationForm");
  const resendEmail = document.getElementById("resendEmail");
  const resendStatusMessage = document.getElementById("resendStatusMessage");
  const resendBtn = document.getElementById("resendVerificationBtn");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  try {
    const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    const data = await response.json();
    status.textContent =
      data.message || (data.success ? "Email verified." : "Unable to verify email.");

    if (
      !data.success &&
      ["expired", "invalid"].includes(data.status) &&
      resendForm
    ) {
      resendForm.hidden = false;
    }
  } catch (error) {
    status.textContent = "Unable to verify email right now. Please try again.";
  }

  resendForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = resendEmail.value.trim();
    if (!email) return;

    resendBtn.disabled = true;
    resendBtn.textContent = "Sending...";

    try {
      const response = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      resendStatusMessage.textContent =
        data.message ||
        "If an account with this email needs verification, we've sent a new link.";
    } catch (error) {
      resendStatusMessage.textContent = "Server error. Please try again.";
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend Verification Email";
    }
  });
});
