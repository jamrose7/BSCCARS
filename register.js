document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  const password = form.querySelectorAll("input[type='password']")[0];
  const confirmPassword = form.querySelectorAll("input[type='password']")[1];

  const eyes = document.querySelectorAll(".eye");

  eyes.forEach((eye, index) => {
    eye.addEventListener("click", () => {
      const input = index === 0 ? password : confirmPassword;
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      eye.classList.toggle("closed", !isHidden);
      eye.setAttribute(
        "aria-label",
        isHidden
          ? index === 0
            ? "Hide password"
            : "Hide confirm password"
          : index === 0
            ? "Show password"
            : "Show confirm password",
      );
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const inputs = form.querySelectorAll("input");
    let valid = true;

    inputs.forEach((input) => {
      if (input.type !== "checkbox" && input.value === "") {
        valid = false;
      }
    });

    if (!valid) {
      alert("Please complete all fields.");
      return;
    }

    if (password.value !== confirmPassword.value) {
      alert("Passwords do not match.");
      return;
    }

    const checkbox = form.querySelector("input[type='checkbox']");
    if (!checkbox.checked) {
      alert("You must confirm your information.");
      return;
    }

    alert("Registration successful!");

    window.location.href = "login.html";
  });
});
