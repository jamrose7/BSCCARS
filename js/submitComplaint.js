document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("complaintForm");
  const modal = document.getElementById("successModal");
  const refId = document.getElementById("refId");
  const summaryBlock = document.getElementById("summaryBlock");
  const viewBtn = document.getElementById("viewComplaintsBtn");
  const dashboardBtn = document.getElementById("goDashboardBtn");
  const closeModal = document.getElementById("closeModal");
  const imageInput = document.getElementById("image");
  const videoInput = document.getElementById("video");
  const imageError = document.getElementById("imageError");
  const videoError = document.getElementById("videoError");
  const eligibilityBanner = document.getElementById("eligibilityBanner");
  const categorySelect = document.getElementById("categoryId");
  const categoryHint = document.getElementById("categoryHint");
  const categoryOtherGroup = document.getElementById("categoryOtherGroup");
  const categoryOtherText = document.getElementById("categoryOtherText");
  const priorityNotice = document.getElementById("priorityNotice");
  const priorityHelp = document.getElementById("priorityHelp");
  const priorityValue = document.getElementById("priorityValue");
  const priorityDisplay = document.getElementById("priorityDisplay");
  const submitButton = form?.querySelector("button[type='submit']");

  let latestEligibility = null;
  let isSubmitting = false;

  const highPriorityCategories = [
    "Physical Harm, Violence, or Threats",
    "Public Health Hazard",
  ];

  const allowedCategories = [
    "Physical Harm, Violence, or Threats",
    "Public Health Hazard",
    "Noise and Public Disturbance",
    "Waste, Sanitation, and Environment",
    "Road and Infrastructure",
    "Property Damage",
    "Animal Concerns",
    "Money Debt",
    "Illegal or Criminal Activity",
    "Other",
  ];

  const IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
  const VIDEO_ACCEPTED_TYPES = ["video/mp4"];
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 10 * 1024 * 1024;
  const MAX_VIDEO_DURATION = 20;

  function clearAttachmentErrors() {
    if (imageError) {
      imageError.textContent = "";
    }
    if (videoError) {
      videoError.textContent = "";
    }
  }

  function showAttachmentError(element, message) {
    if (element) {
      element.textContent = message;
    }
    showNotification(message, "error");
  }

  function setEligibilityBanner(message, isError = true) {
    if (!eligibilityBanner) {
      return;
    }

    eligibilityBanner.textContent = message;
    eligibilityBanner.style.display = message ? "flex" : "none";
    eligibilityBanner.classList.toggle("warning-banner", isError);
  }

  function formatOtherValue(baseValue, specifyText) {
    return baseValue === "Other" && specifyText
      ? `Other: ${specifyText}`
      : baseValue;
  }

  function setOtherCategoryControls(isOther) {
    if (categoryOtherGroup) {
      categoryOtherGroup.style.display = isOther ? "block" : "none";
    }
    if (categoryOtherText) {
      categoryOtherText.disabled = !isOther;
      categoryOtherText.required = isOther;
      if (!isOther) {
        categoryOtherText.value = "";
      }
    }
  }

  function getCategoryPriority(category) {
    return highPriorityCategories.includes(category) ? "high" : "normal";
  }

  function updatePriorityDisplay(category) {
    const isUrgent = highPriorityCategories.includes(category);
    const value = isUrgent ? "High Priority" : "Normal";
    const helpText = isUrgent
      ? "This category is automatically classified as High Priority because it may involve danger, violence, or public health risk."
      : "This category is classified as Normal Priority for standard barangay review.";

    if (priorityValue) {
      priorityValue.textContent = value;
    }

    if (priorityDisplay) {
      priorityDisplay.dataset.priority = isUrgent ? "high" : "normal";
    }

    if (priorityHelp) {
      priorityHelp.textContent = helpText;
      priorityHelp.style.display = "block";
    }
  }

  function updateSubmissionTimeframeGuidance(priority) {
    const note = document.getElementById("submissionTimeframeNote");
    const bullet = document.getElementById("submissionTimeframeBullet");
    const priorityBullet = document.getElementById("submissionPriorityBullet");
    const isHigh = priority === "high";

    if (note) {
      note.textContent = isHigh
        ? "This High Priority complaint is flagged for urgent barangay review. If there is immediate danger, contact the barangay office or emergency responders directly. BSCCARS is not an emergency hotline."
        : "Barangay Sillon aims to review and update Normal Priority complaints within 3 days. Please send a follow-up only if you have new information or no update has been posted after that timeframe.";
      note.dataset.priority = isHigh ? "high" : "normal";
    }

    if (bullet) {
      bullet.textContent = isHigh
        ? "This complaint is flagged for urgent barangay review."
        : "Expected update timeframe is within 3 days for Normal Priority complaints.";
    }

    if (priorityBullet) {
      priorityBullet.textContent = isHigh
        ? "For immediate danger, contact the barangay office or emergency responders directly. BSCCARS is not an emergency hotline."
        : "High Priority categories are flagged for urgent barangay review.";
    }
  }

  function setPriorityControls(category) {
    const isUrgent = highPriorityCategories.includes(category);
    const isOther = category === "Other";

    setRespondentSectionVisibility(category);

    if (priorityNotice) {
      priorityNotice.textContent = isUrgent
        ? "This category has been automatically marked as High Priority due to its urgent nature. The barangay admin will be notified immediately upon submission."
        : "";
      priorityNotice.style.display = isUrgent ? "flex" : "none";
    }

    if (categoryHint) {
      categoryHint.textContent = isOther
        ? "Other: please specify the complaint category below."
        : "";
      categoryHint.style.display = isOther ? "block" : "none";
    }
    setOtherCategoryControls(isOther);
    updatePriorityDisplay(category);
  }

  async function loadComplaintEligibility() {
    if (typeof api === "undefined" || !api.checkComplaintEligibility) {
      return;
    }

    try {
      const response = await api.checkComplaintEligibility();
      const eligibility = response?.data || null;
      latestEligibility = eligibility;
      const canSubmit = eligibility?.eligible !== false;

      if (!eligibility || !eligibility.eligible) {
        setEligibilityBanner(
          eligibility?.reason ||
            "Your account cannot submit new complaints at this time.",
        );
      } else {
        setEligibilityBanner("");
      }

      if (submitButton) {
        submitButton.disabled = !canSubmit;
      }
    } catch (error) {
      console.warn("Unable to fetch complaint eligibility:", error);
      setEligibilityBanner("");
    }
  }

  function setRespondentSectionVisibility(category) {
    const section = document.getElementById("respondentInfoSection");
    if (!section) return;

    const isMoneyDebt = category === "Money Debt";
    section.style.display = isMoneyDebt ? "block" : "none";

    const nameInput = document.getElementById("respondentName");
    if (nameInput) nameInput.required = isMoneyDebt;
    const purokInput = document.getElementById("respondentPurok");
    if (purokInput) purokInput.required = isMoneyDebt;

    if (!isMoneyDebt) {
      // Clear stale data so it can't be submitted under the wrong category
      const nameInput = document.getElementById("respondentName");
      const contactInput = document.getElementById("respondentContactNumber");
      const purokInput = document.getElementById("respondentPurok");
      if (nameInput) nameInput.value = "";
      if (contactInput) contactInput.value = "";
      if (purokInput) purokInput.value = "";
    }
  }

  function validateImageFile(file) {
    if (!file) {
      return { valid: true };
    }

    if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) {
      return {
        valid: false,
        message: "Only JPG, JPEG, and PNG image formats are allowed.",
      };
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        message: "Image must not exceed 5MB.",
      };
    }

    return { valid: true };
  }

  function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(0);
        return;
      }

      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.style.display = "none";
      document.body.appendChild(video);

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.addEventListener("loadedmetadata", () => {
        const duration = video.duration;
        URL.revokeObjectURL(objectUrl);
        video.remove();
        resolve(duration);
      });

      video.addEventListener("error", (error) => {
        URL.revokeObjectURL(objectUrl);
        video.remove();
        reject(new Error("Unable to read video duration."));
      });
    });
  }

  async function validateVideoFile(file) {
    if (!file) {
      return { valid: true };
    }

    if (!VIDEO_ACCEPTED_TYPES.includes(file.type)) {
      return {
        valid: false,
        message: "Only MP4 video format is allowed.",
      };
    }

    if (file.size > MAX_VIDEO_SIZE) {
      return {
        valid: false,
        message: "Video must not exceed 10MB.",
      };
    }

    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_DURATION) {
        return {
          valid: false,
          message: "Video must not exceed 20 seconds.",
        };
      }
    } catch (error) {
      return {
        valid: false,
        message: "Unable to validate video duration.",
      };
    }

    return { valid: true };
  }

  function formatDisplayTime(timeValue) {
    if (!timeValue) {
      return "Not specified";
    }

    const [hours, minutes] = timeValue.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function initPriorityControlEvents() {
    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        setPriorityControls(categorySelect.value);
      });
    }

    if (categorySelect) {
      setPriorityControls(categorySelect.value);
    }
  }

  initPriorityControlEvents();
  loadComplaintEligibility();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    const originalSubmitText = submitButton?.textContent || "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }
    clearAttachmentErrors();

    let submissionSucceeded = false;
    let confirmedId = "";
    let displayCategory = "";
    let purok = "";
    let date = "";
    let time = "";
    let priority = "normal";
    let confidential = false;

    try {
      const title = document.getElementById("title").value.trim();
      const category = document.getElementById("categoryId").value;
      const categoryOther = categoryOtherText?.value.trim() || "";
      displayCategory = formatOtherValue(category, categoryOther);
      const details = document.getElementById("details").value.trim();
      const respondentName =
        document.getElementById("respondentName")?.value.trim() || "";
      const respondentContactNumber =
        document.getElementById("respondentContactNumber")?.value.trim() || "";
      if (
          respondentContactNumber &&
          !/^09\d{9}$/.test(respondentContactNumber)
      ) {
        showNotification(
        "Respondent contact number must be 11 digits and start with 09.",
        "error",
      );
      document.getElementById("respondentContactNumber")?.focus();
      return;
    }
      const respondentPurok =
        document.getElementById("respondentPurok")?.value.trim() || "";
      purok = document.getElementById("purokId").value;
      date = document.getElementById("incidentDate").value;
      time = document.getElementById("incidentTime").value;
      priority = getCategoryPriority(category);
      confidential = document.getElementById("confidential").checked;
      const image = imageInput?.files[0];
      const video = videoInput?.files[0];

    if (!title || !details || !category || !purok) {
      showNotification("Please complete all required fields.", "error");
      return;
    }

    if (!allowedCategories.includes(category)) {
      showNotification("Please select a valid complaint category.", "error");
      return;
    }

    if (category === "Other" && !categoryOther) {
      showNotification("Please specify the Other complaint category.", "error");
      categoryOtherText?.focus();
      return;
    }

    if (category === "Money Debt" && !respondentName) {
      showNotification(
      "Please provide the respondent's full name for Money Debt complaints.",
      "error",
    );
      document.getElementById("respondentName")?.focus();
      return;
    }

    if (category === "Money Debt" && !respondentPurok) {
      showNotification(
        "Please select the respondent's purok for Money Debt complaints.",
        "error",
      );
      document.getElementById("respondentPurok")?.focus();
      return;
    }

    if (!date) {
      showNotification("Please provide the incident date.", "error");
      document.getElementById("incidentDate")?.focus();
      return;
    }

    if (latestEligibility && !latestEligibility.eligible) {
      showNotification(
        latestEligibility.reason || "Complaint submission is restricted.",
        "error",
      );
      return;
    }

    const imageValidation = validateImageFile(image);
    if (!imageValidation.valid) {
      showAttachmentError(imageError, imageValidation.message);
      return;
    }

    const videoValidation = await validateVideoFile(video);
    if (!videoValidation.valid) {
      showAttachmentError(videoError, videoValidation.message);
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    if (category === "Other") {
      formData.append("categorySpecify", categoryOther);
    }
    formData.append("details", details);
    formData.append("respondent_name", respondentName);
    formData.append("respondent_contact_number", respondentContactNumber);
    formData.append("respondent_purok", respondentPurok);
    formData.append("purok", purok);
    formData.append("incidentDate", date);
    formData.append("incidentTime", time);
    formData.append("priority", priority);
    formData.append("confidentiality", confidential ? "Confidential" : "Public");
    if (image) {
      formData.append("image", image);
    }
    if (video) {
      formData.append("video", video);
    }

      const response = await api.createComplaint(formData);
      if (!response.success) {
        throw new Error(response.message || "Complaint submission failed.");
      }

      submissionSucceeded = true;
      confirmedId = response?.data?.id || "";
      if (confirmedId) {
        refId.textContent = confirmedId;
      }
      showNotification(
        "Your complaint has been submitted successfully.",
        "success",
      );
      form.reset();
      setOtherCategoryControls(false);
    } catch (error) {
      console.error(error);
      showNotification(
        error.message || "Complaint submission failed. Please try again.",
        "error",
      );
    } finally {
      isSubmitting = false;
      if (submitButton) {
        submitButton.disabled = Boolean(latestEligibility && !latestEligibility.eligible);
        submitButton.textContent = originalSubmitText;
      }
    }

    if (submissionSucceeded) {
      summaryBlock.replaceChildren();
      [
        ["Category", displayCategory],
        ["Purok", purok],
        ["Priority", priority === "high" ? "High Priority" : "Normal"],
        [
          "Incident",
          `${date}${time ? " at " + formatDisplayTime(time) : ""}`,
        ],
        ["Confidentiality", confidential ? "Confidential" : "Public"],
      ].forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        paragraph.appendChild(strong);
        paragraph.append(document.createTextNode(value));
        summaryBlock.appendChild(paragraph);
      });
      summaryBlock.hidden = false;
      updateSubmissionTimeframeGuidance(priority);

      modal.style.display = "flex";
    }
  });

  viewBtn.addEventListener("click", () => {
    window.location.href = "myComplaints.html";
  });

  dashboardBtn.addEventListener("click", () => {
    window.location.href = "residentDashboard.html";
  });

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});
