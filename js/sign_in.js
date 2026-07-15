document.addEventListener("DOMContentLoaded", async () => {
  // If loaded directly from filesystem, redirect to the local server
  if (
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" || window.location.origin === "null")
  ) {
    // Try a quick health check before redirecting so users aren't sent to
    // localhost when the server isn't running (which causes ERR_CONNECTION_REFUSED).
    const healthUrl = "http://localhost:3000/api/health";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
      const resp = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp && resp.ok) {
        window.location.href = "http://localhost:3000/sign_in.html";
      } else {
        showNotification(
          "Local server not reachable. Start it with: `node backend/server.js`",
          "error",
        );
      }
    } catch (err) {
      clearTimeout(timeout);
      showNotification(
        "Local server not reachable. Start it with: `node backend/server.js`",
        "error",
      );
    }

    return;
  }

  const form = document.getElementById("sign_inForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const eye = document.querySelector(".eye");
  const rememberCheckbox = document.getElementById("remember");

  let submitBtn = null;
  if (form) submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) submitBtn = document.querySelector('button[type="submit"]');

  if (eye) {
    eye.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      eye.classList.toggle("closed", !isHidden);
      eye.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password",
      );
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const rememberMe = rememberCheckbox?.checked || false;

      if (!email || !password) {
        showNotification("Please fill in all fields", "error");
        return;
      }

      if (!Validators.email(email)) {
        showNotification("Please enter a valid email address", "error");
        return;
      }

      try {
        setButtonLoading(submitBtn, true);
        showLoading("Signing in...");

        const response = await api.signIn(email, password);

        if (response && response.success) {
          completeSignIn(response.token, response.user, rememberMe, email);
          return;
        }

        const message =
          (response && response.message) ||
          "Sign in failed. Please check your credentials.";
        showNotification(message, "error");
      } catch (error) {
        console.error("Sign in failed:", error);
        const errMsg =
          error && error.message
            ? error.message
            : "Sign in failed. Please check your credentials.";
        showNotification(errMsg, "error");
      } finally {
        hideLoading();
        setButtonLoading(submitBtn, false);
      }
    });
  }

  const rememberedEmail = localStorage.getItem("rememberEmail");
  if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }

  const forgotLink = form?.querySelector(".forgot");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "forgot_password.html";
    });
  }
});

function completeSignIn(token, user, rememberMe, email) {
  api.setToken(token);
  api.setUser(user);

  if (rememberMe) {
    localStorage.setItem("rememberEmail", email);
  } else {
    localStorage.removeItem("rememberEmail");
  }

  showNotification("Sign in successful!", "success", 1200);

  setTimeout(() => {
  if (
  user.role === "super_admin" ||
  user.role === "assistant_admin"
  ) {
  window.location.href = "adminDashboard.html";
  } else if (user.role === "resident") {
  window.location.href = "residentDashboard.html";
  } else {
  console.error("Unknown role:", user.role);
  window.location.href = "sign_in.html";
  }
  }, 400);
}
