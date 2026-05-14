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

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = newPassword.value;
    const confirmPassword = confirmNewPassword.value;

    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    if (!password) {
      alert("Please enter a new password.");
      return;
    }

    if (!confirmPassword) {
      alert("Please confirm your new password.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    console.log("Password reset request for:", email);

    modal.classList.add("show");
  });
});