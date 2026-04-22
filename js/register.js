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

  // File upload preview
  const fileInput = document.getElementById("idUpload");
  const preview = document.getElementById("idPreview");
  const filePicker = document.querySelector(".file-picker");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
        filePicker.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const inputs = form.querySelectorAll("input");
    let valid = true;

    inputs.forEach((input) => {
      if (input.type !== "checkbox" && input.type !== "file" && input.value === "") {
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

    alert("Account Created Successfully\n\nYour account is currently waiting for Barangay Admin approval.\n\nPlease wait for verification before logging in.");
    window.location.href = 'index.html';
  });
});
