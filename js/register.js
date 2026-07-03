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

  const PENDING_RESIDENTS_KEY = "bsccarsPendingResidents";
  const USER_ID_YEAR = "2026";

  // IndexedDB is used because ID uploads are binary (Base64 DataURL),
  // which exceed localStorage limits and are not suitable for JSON storage.
  const ID_DB_NAME = "bsccarsResidentUploads";
  const ID_STORE = "residentIds";

  // IndexedDB: file storage layer

  function openIdDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ID_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(ID_STORE)) {
          db.createObjectStore(ID_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = () =>
        reject(new Error("Failed to initialize ID storage database."));
    });
  }

  async function storeResidentId(residentId, fileDataUrl) {
    const db = await openIdDatabase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(ID_STORE, "readwrite");
      tx.objectStore(ID_STORE).put(fileDataUrl, residentId);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        db.close();
        reject(new Error("Failed to store uploaded ID file."));
      };
    });
  }

  // File processing

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Unable to read uploaded ID file."));

      reader.readAsDataURL(file);
    });
  }

  // Temporary storage layer
  // localStorage is used only for metadata because there is no backend API yet.
  // This will be replaced with database persistence in production.

  function getPendingResidents() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_RESIDENTS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function savePendingResident(resident) {
    const list = getPendingResidents();
    list.unshift(resident);
    localStorage.setItem(PENDING_RESIDENTS_KEY, JSON.stringify(list));
  }

  // Writes into the same storage key notificationManager.js reads
  // (bsccarsLocalNotifications), so the admin notification panel shows
  // the actual resident who just registered instead of a generic count.
  const LOCAL_NOTIFICATIONS_KEY = "bsccarsLocalNotifications";

  function notifyAdminsOfNewRegistration(resident) {
    try {
      const notifications =
        JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY)) || [];
      notifications.unshift({
        id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: "New resident registration",
        message: `${resident.firstName} ${resident.lastName} registered and is awaiting approval.`,
        roles: ["admin", "super_admin"],
        created_at: new Date().toISOString(),
        is_read: false,
      });
      localStorage.setItem(
        LOCAL_NOTIFICATIONS_KEY,
        JSON.stringify(notifications.slice(0, 100)),
      );
    } catch (error) {
      console.warn("Unable to record registration notification:", error);
    }
  }

  function formatUserId(sequence) {
    return `${USER_ID_YEAR}${String(sequence).padStart(3, "0")}`;
  }

  function generateResidentUserId() {
    const pendingIds = getPendingResidents()
      .map((resident) => resident.id)
      .filter((id) => /^2026\d{3}$/.test(String(id)));
    const currentUser =
      typeof api !== "undefined" ? api.getStoredUser?.() : null;
    const knownIds = [...pendingIds, currentUser?.id].filter((id) =>
      /^2026\d{3}$/.test(String(id)),
    );
    const sequences = knownIds.map((id) => Number(String(id).slice(4)));
    const nextSequence = sequences.length ? Math.max(...sequences) + 1 : 4;
    return formatUserId(nextSequence);
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
  // Combines:
  // - file storage (IndexedDB for binary data)
  // - metadata storage (localStorage as temporary backend replacement)

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateMiddleName()) {
      middleName.focus();
      return;
    }

    if (!form.checkValidity()) {
      alert("Please complete all required fields.");
      return;
    }

    if (password.value !== confirmPassword.value) {
      alert("Passwords do not match.");
      return;
    }

    const terms = form.querySelector("#terms");
    if (terms && !terms.checked) {
      alert("Please confirm your information.");
      return;
    }

    const file = validId.files[0];

    if (!file) {
      alert("Please upload a valid ID.");
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;

    // Prevent browser storage overload and performance issues
    if (file.size > MAX_SIZE) {
      alert("File must not exceed 5MB.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      const fileDataUrl = await fileToDataUrl(file);

      const residentId = generateResidentUserId();

      const resident = {
        id: residentId,
        firstName: form.firstName.value.trim(),
        lastName: form.lastName.value.trim(),
        middleName: noMiddleName.checked ? null : middleName.value.trim(),
        noMiddleName: noMiddleName.checked,
        suffix: form.suffix.value || "None",
        dateOfBirth: form.dateOfBirth.value,
        purok: form.purokId.value,
        contactNumber: form.contactNumber.value.trim(),
        email: form.email.value.trim(),
        status: "Pending",
        validId: {
          name: file.name,
          type: file.type,
          dataUrl: fileDataUrl,
        },
        warning_count: 0,
        is_restricted: false,
        submittedAt: new Date().toISOString(),
      };

      await storeResidentId(residentId, fileDataUrl);
      savePendingResident(resident);
      notifyAdminsOfNewRegistration(resident);

      form.reset();
      syncMiddleNameState({ validate: false });
      successModal.classList.add("show");
    } catch (err) {
      alert(err.message);
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