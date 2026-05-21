document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const password = form.querySelector("input#password");
  const confirmPassword = form.querySelector("input#confirmPassword");
  const eyes = document.querySelectorAll(".eye");
  const modal = document.getElementById("successModal");
  const backBtn = document.getElementById("backToSignin");

  eyes.forEach((eye, index) => {
    eye.addEventListener("click", () => {
      const input = index === 0 ? password : confirmPassword;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      eye.classList.toggle("closed", !isHidden);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // Use HTML5 constraint validation to ensure required selects and inputs are covered
    if (!form.checkValidity()) {
      alert("Please complete all required fields.");
      return;
    }

    if (password.value !== confirmPassword.value) {
      alert("Passwords do not match.");
      return;
    }

    const termsCheckbox = form.querySelector("input#terms");
    if (termsCheckbox && !termsCheckbox.checked) {
      alert("You must confirm your information.");
      return;
    }

    modal.classList.add("show");
  });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "sign_in.html";
    });
  }
});