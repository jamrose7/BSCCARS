document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const passwordInput = document.querySelector("input[type='password']");
  const eye = document.querySelector(".eye");

  eye.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    eye.classList.toggle("closed", !isHidden);
    eye.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password",
    );
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = form.querySelector("input[type='text']").value;
    const password = passwordInput.value;

    if (username === "" || password === "") {
      alert("Please fill in all fields.");
      return;
    }

    const isAdmin = username.toLowerCase() === "admin";

    if (isAdmin) {
      if (password === "admin578") {
        alert("Admin sign in successful!");
        window.location.href = "adminDashboard.html";
      } else {
        alert("Invalid admin credentials.");
      }
    } else {
      alert("Resident sign in successful!");
      window.location.href = "residentDashboard.html";
    }
  });
});
