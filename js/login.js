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

  const adminBtn = document.querySelector(".admin-btn");
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      window.location.href = "AdminLogin.html";
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = form.querySelector("input[type='text']").value;
    const password = passwordInput.value;

    if (username === "" || password === "") {
      alert("Please fill in all fields.");
      return;
    }

    alert("Login successful!");

    window.location.href = "user-dashboard.html";
  });
});
