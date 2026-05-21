document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("sign_inForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const eye = document.querySelector(".eye");
  const rememberCheckbox = document.getElementById("remember");
  const submitBtn = form.querySelector('button[type="submit"]');

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

      const response = await api.signin(email, password);

      if (response.success) {
        completeSignIn(response.token, response.user, rememberMe, email);
      }
    } catch (error) {
      console.error("Sign in failed:", error);

      const demoUser = getDemoUser(email, password);
      if (demoUser) {
        completeSignIn("demo-token", demoUser, rememberMe, email);
        return;
      }

      showNotification("Sign in failed. Please check your credentials.", "error");
    } finally {
      hideLoading();
      setButtonLoading(submitBtn, false);
    }
  });

  const rememberedEmail = localStorage.getItem("rememberEmail");
  if (rememberedEmail) {
    emailInput.value = rememberedEmail;
    rememberCheckbox.checked = true;
  }

  const forgotLink = form.querySelector(".forgot");
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
    if (user.role === "super_admin" || user.role === "admin") {
      window.location.href = "adminDashboard.html";
    } else {
      window.location.href = "residentDashboard.html";
    }
  }, 400);
}

function getDemoUser(email, password) {
  const normalizedEmail = email.toLowerCase();

  if (normalizedEmail === "admin@gmail.com" && password === "admin578") {
    return {
      id: 1,
      email,
      role: "super_admin",
      first_name: "Jamiel",
      last_name: "Rosell",
    };
  }

  if (normalizedEmail === "secretary@gmail.com" && password === "secretary123") {
    return {
      id: 3,
      email,
      role: "admin",
      first_name: "Kiarah",
      last_name: "Beau",
    };
  }

  if (normalizedEmail === "resident@gmail.com" && password === "resident789") {
    return {
      id: 2,
      email,
      role: "resident",
      first_name: "Aeron",
      last_name: "Smith",
    };
  }

  return null;
}