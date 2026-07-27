document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  const password = form.querySelector("#password");
  const confirmPassword = form.querySelector("#confirmPassword");
  const middleName = form.querySelector("#middleName");
  const noMiddleName = form.querySelector("#noMiddleName");
  const middleNameError = form.querySelector("#middleNameError");
  const validId = form.querySelector("#validId");

  const eyeToggles = document.querySelectorAll(".eye");
  const successModal = document.getElementById("successModal");
  const backToSigninBtn = document.getElementById("backToSignin");

  const submitButton = form.querySelector('button[type="submit"]');

  // File processing
  // Converts the uploaded ID image into a base64 Data URL so it can be
  // sent as part of the JSON payload to POST /api/auth/register.

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Unable to read uploaded ID file."));

      reader.readAsDataURL(file);
    });
  }

  // UI behavior

  function setMiddleNameError(message = "") {
    if (!middleName || !middleNameError) {
      return;
    }

    middleName.setCustomValidity(message);
    middleName.classList.toggle("input-error", Boolean(message));
    middleNameError.textContent = message;
  }

  function validateMiddleName() {
    if (!middleName || !noMiddleName) {
      return true;
    }

    if (noMiddleName.checked) {
      setMiddleNameError("");
      return true;
    }

    const value = middleName.value.trim();

    if (value.length === 1) {
      setMiddleNameError(
        "Please enter your complete middle name, not just an initial.",
      );
      return false;
    }

    if (value.length < 2) {
      setMiddleNameError(
        'Please enter your complete middle name or tick "I have no middle name".',
      );
      return false;
    }

    setMiddleNameError("");
    return true;
  }

  function syncMiddleNameState({ validate = true } = {}) {
    if (!middleName || !noMiddleName) {
      return;
    }

    if (noMiddleName.checked) {
      middleName.value = "";
      middleName.disabled = true;
      setMiddleNameError("");
      return;
    }

    middleName.disabled = false;
    if (validate) {
      validateMiddleName();
    }
  }

  if (middleName) {
    middleName.addEventListener("input", validateMiddleName);
    middleName.addEventListener("blur", validateMiddleName);
  }

  if (noMiddleName) {
    noMiddleName.addEventListener("change", syncMiddleNameState);
    syncMiddleNameState({ validate: false });
  }

  eyeToggles.forEach((eye, index) => {
    eye.addEventListener("click", () => {
      const input = index === 0 ? password : confirmPassword;
      const showPassword = input.type === "password";

      input.type = showPassword ? "text" : "password";
      eye.classList.toggle("closed", !showPassword);
    });
  });

  // Submission flow
  // Sends the registration payload to the real backend via api.register(),
  // which calls POST /api/auth/register. The backend creates a Pending
  // entry in residentApplications and notifies admins itself — this file
  // must not write any local mock data or local notifications.

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateMiddleName()) {
      middleName.focus();
      return;
    }

    if (!form.checkValidity()) {
      showNotification("Please complete all required fields.", "error");
      return;
    }

    if (password.value !== confirmPassword.value) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    const terms = form.querySelector("#terms");
    if (terms && !terms.checked) {
      showNotification("Please confirm your information.", "error");
      return;
    }

    const file = validId.files[0];

    if (!file) {
      showNotification("Please upload a valid ID.", "error");
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
      showNotification("File must not exceed 5MB.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      const fileDataUrl = await fileToDataUrl(file);

      const payload = {
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        middleName: noMiddleName.checked ? "" : middleName.value.trim(),
        noMiddleName: noMiddleName.checked,
        suffix: form.suffix.value || "None",
        dateOfBirth: form.dateOfBirth.value,
        purok: form.purokId.value,
        contactNumber: form.contactNumber.value.trim(),
        email: form.email.value.trim(),
        password: password.value,
        validId: {
          name: file.name,
          type: file.type,
          dataUrl: fileDataUrl,
        },
      };

      const response = await api.register(payload);

      if (!response || !response.success) {
        throw new Error(
          (response && response.message) ||
            "Registration failed. Please try again.",
        );
      }

      form.reset();
      syncMiddleNameState({ validate: false });
      successModal.classList.add("show");
    } catch (err) {
      showNotification(
        err.message || "Registration failed. Please try again.",
        "error",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Register";
    }
  });

  // Navigation

  if (backToSigninBtn) {
    backToSigninBtn.addEventListener("click", () => {
      window.location.href = "sign_in.html";
    });
  }
});