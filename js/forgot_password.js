document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const newPassword = document.getElementById("newPassword");
  const confirmNewPassword = document.getElementById("confirmNewPassword");
  const eyes = document.querySelectorAll(".eye");
  const modal = document.getElementById("successModal");

  eyes.forEach((eye, index) => {
    eye.addEventListener("click", () => {
      const input = index === 0 ? newPassword : confirmNewPassword;
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      eye.classList.toggle("closed", !isHidden);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = newPassword.value;
    const confirmPassword = confirmNewPassword.value;

    if (!email) {
      showNotification("Please enter your email address.", "error");
      return;
    }

    if (!password) {
      showNotification("Please enter a new password.", "error");
      return;
    }

    if (!confirmPassword) {
      showNotification("Please confirm your new password.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 8) {
      showNotification("Password must be at least 8 characters long.", "error");
      return;
    }

    try {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, newPassword: password }),
  });
  const data = await response.json();
  if (data.success) {
    modal.classList.add("show");
  } else {
    showNotification(data.message || "Reset failed.", "error");
  }
} catch (err) {
  showNotification("Server error. Please try again.", "error");
}

  });
});
