document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  const password = form.querySelector("#password");
  const confirmPassword = form.querySelector("#confirmPassword");
  const middleName = form.querySelector("#middleName");
  const middleNameError = form.querySelector("#middleNameError");
  const validId = form.querySelector("#validId");

  const dateOfBirth = form.querySelector("#dateOfBirth");

  const dobError = document.createElement("p");
  dobError.className = "field-error";
  dobError.setAttribute("aria-live", "polite");
  if (dateOfBirth) {
    dateOfBirth.insertAdjacentElement("afterend", dobError);
  }

  function validateDateOfBirth() {
    const value = dateOfBirth.value;
    if (!value) {
      dateOfBirth.setCustomValidity("");
      dobError.textContent = "";
      return true;
    }
    if (!Validators.adultAge(value)) {
      dateOfBirth.setCustomValidity("Must be 18 or older");
      dobError.textContent =
        "You must be at least 18 years old to register. If you are a minor, please have a parent or guardian file the complaint using their own account.";
      return false;
    }
    dateOfBirth.setCustomValidity("");
    dobError.textContent = "";
    return true;
  }

  if (dateOfBirth) {
    dateOfBirth.addEventListener("change", validateDateOfBirth);
    dateOfBirth.addEventListener("blur", validateDateOfBirth);
  }

  const eyeToggles = document.querySelectorAll(".eye");
  const successModal = document.getElementById("successModal");
  const backToSigninBtn = document.getElementById("backToSignin");

  const submitButton = form.querySelector('button[type="submit"]');

  // Convert the selected ID image to a data URL for the registration request.
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read uploaded ID file."));
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
    if (!middleName) {
      return true;
    }

    const value = middleName.value.trim();

    if (!value) {
      setMiddleNameError("");
      return true;
    }

    if (value.length === 1) {
      setMiddleNameError(
        "Please enter your complete middle name, not just an initial.",
      );
      return false;
    }
    setMiddleNameError("");
    return true;
  }

  if (middleName) {
    middleName.addEventListener("input", validateMiddleName);
    middleName.addEventListener("blur", validateMiddleName);
  }

  // Draft autosave/restore — survives Back button, "Back to Registration",
  // and accidental refresh. Deliberately excludes password, confirmPassword,
  // validId (file inputs can't be restored by any browser), and the terms
  // checkbox (consent should be re-confirmed, not silently carried over).
  const DRAFT_KEY = "bsccarsRegisterDraft";
  const draftFieldIds = [
    "firstName", "lastName", "middleName",
    "suffix", "dateOfBirth", "purokId", "contactNumber", "email",
  ];

  function saveDraft() {
    const draft = {};
    draftFieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      draft[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function flagFieldForAttention(inputEl, message) {
    if (!inputEl) return;

    inputEl.classList.add("needs-attention");

    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.setAttribute("aria-live", "polite");
    hint.textContent = message;

    // Password inputs are wrapped in .password-field (for the eye icon);
    // insert the hint after that wrapper so it doesn't land mid-wrapper.
    const anchor = inputEl.closest(".password-field") || inputEl;
    anchor.insertAdjacentElement("afterend", hint);

    const clearFlag = () => {
      inputEl.classList.remove("needs-attention");
      hint.remove();
      inputEl.removeEventListener("input", clearFlag);
      inputEl.removeEventListener("change", clearFlag);
    };

    inputEl.addEventListener("input", clearFlag);
    inputEl.addEventListener("change", clearFlag);
  }

  function restoreDraft() {
    let draft;
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch {
      draft = null;
    }
    if (!draft) return;

    draftFieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || !(id in draft)) return;
      if (el.type === "checkbox") {
        el.checked = draft[id];
      } else {
        el.value = draft[id];
      }
    });

    validateMiddleName();

    showNotification(
      "We restored your previously entered details. Please choose your Valid ID file again — it can't be restored automatically.",
      "info",
      5000,
    );
    flagFieldForAttention(password, "Please re-enter your password.");
    flagFieldForAttention(confirmPassword, "Please re-enter your password to confirm.");
    flagFieldForAttention(validId, "Please re-select your Valid ID file.");
  }

  restoreDraft();

  draftFieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", saveDraft);
    el.addEventListener("change", saveDraft);
  });

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
  // which calls POST /api/auth/register. The backend creates the Pending
  // resident row and notifies admins itself; this file must not write any
  // local data or local notifications.

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateMiddleName()) {
      middleName.focus();
      return;
    }

    if (!validateDateOfBirth()) {
      dateOfBirth.focus();
      return;
    }

    if (!form.checkValidity()) {
      showNotification("Please complete all required fields.", "error");
      return;
    }

    if (!Validators.password(password.value)) {
      showNotification("Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number and a special character.", "error");
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
        middleName: middleName.value.trim(),
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
        setMiddleNameError("");
        sessionStorage.removeItem(DRAFT_KEY); // clear draft after successful submission
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
