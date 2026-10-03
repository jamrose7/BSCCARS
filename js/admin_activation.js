document.addEventListener("DOMContentLoaded", () => {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const form = document.getElementById("activationForm");
  const intro = document.getElementById("introText");
  const button = document.getElementById("activateBtn");

   [
    { btn: document.getElementById("toggleNewPassword"), input: document.getElementById("newPassword") },
    { btn: document.getElementById("toggleConfirmNewPassword"), input: document.getElementById("confirmNewPassword") },
  ].forEach(({ btn, input }) => {
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.classList.toggle("closed", !isHidden);
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });

  async function post(path, body) {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
    return data;
  }

  async function validate() {
    try {
      await post("validate-admin-activation-token", { token });
      intro.textContent = "Create your permanent password.";
      form.hidden = false;
    } catch (error) {
      intro.textContent = error.message || "This activation link is invalid or expired.";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmNewPassword").value;
    if (newPassword !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }
    if (!Validators.password(newPassword)) {
      showNotification("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.", "error");
      return;
    }
    setButtonLoading(button, true);
    try {
      await post("activate-admin", { token, newPassword, confirmPassword });
      showNotification("Account activated. Please sign in.", "success");
      setTimeout(() => window.location.assign("sign_in.html"), 1200);
    } catch (error) {
      showNotification(error.message || "Activation failed.", "error");
      setButtonLoading(button, false);
    }
  });

  validate();
});
