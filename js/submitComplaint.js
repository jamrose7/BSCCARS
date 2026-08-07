document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("complaintForm");
  const modal = document.getElementById("successModal");
  const refId = document.getElementById("refId");
  const summaryBlock = document.getElementById("summaryBlock");
  const viewBtn = document.getElementById("viewComplaintsBtn");
  const dashboardBtn = document.getElementById("goDashboardBtn");
  const closeModal = document.getElementById("closeModal");
  const complaintsKey = "bsccarsComplaints";
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
  const highPriorityConfirmation = document.getElementById(
    "highPriorityConfirmation",
  );
  const confirmHighPriority = document.getElementById("confirmHighPriority");
  const submitButton = form?.querySelector("button[type='submit']");

  let latestEligibility = null;

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

  function toggleHighPriorityConfirmation(visible) {
    if (!highPriorityConfirmation) {
      return;
    }

    highPriorityConfirmation.style.display = visible ? "block" : "none";
    if (!visible && confirmHighPriority) {
      confirmHighPriority.checked = false;
    }
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

  function updatePriorityHelpText(category, selectedHigh) {
    const isUrgent = highPriorityCategories.includes(category);
    let helpText =
      "Select Normal for routine concerns. High Priority is for emergencies, threats, or urgent hazards that need faster review.";

    if (isUrgent) {
      helpText =
        "This category is automatically classified as High Priority because it involves danger, violence, or a public health hazard.";
    } else if (selectedHigh) {
      helpText =
        "You selected High Priority. Please confirm that this issue is urgent and not a routine complaint. Misuse of High Priority may be reviewed by barangay staff.";
    } else {
      helpText =
        "Normal priority is recommended for routine complaints and helps barangay staff manage submissions fairly.";
    }

    if (priorityHelp) {
      priorityHelp.textContent = helpText;
      priorityHelp.style.display = "block";
    }
  }

    function setPriorityControls(category) {
    const isUrgent = highPriorityCategories.includes(category);
    const isOther = category === "Other";
    const radios = Array.from(
      document.querySelectorAll("input[name='priority']"),
    );

    setRespondentSectionVisibility(category);

    radios.forEach((radio) => {
      radio.disabled = isUrgent;
      if (isUrgent) {
        radio.checked = radio.value === "high";
      }
    });

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

    if (isUrgent) {
      toggleHighPriorityConfirmation(false);
      updatePriorityHelpText(category, true);
      return;
    }

    const selectedHigh = radios.some(
      (radio) => radio.value === "high" && radio.checked,
    );
    toggleHighPriorityConfirmation(selectedHigh);
    updatePriorityHelpText(category, selectedHigh);
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

  function getStoredComplaints() {
    try {
      return JSON.parse(localStorage.getItem(complaintsKey)) || [];
    } catch (error) {
      return [];
    }
  }

  function saveComplaint(complaint) {
    const complaints = getStoredComplaints();
    complaints.unshift(complaint);
    localStorage.setItem(complaintsKey, JSON.stringify(complaints));
  }

  function formatComplaintNumber(sequence) {
    return `CMP-2026-${String(sequence).padStart(4, "0")}`;
  }

  function generateComplaintNumber() {
    const existingSequences = getStoredComplaints()
      .map((complaint) => String(complaint.id || complaint.referenceId || ""))
      .map((id) => {
        const match = id.match(/(?:#C-)?(?:CMP-)?2026[-\s]?(\d+)/);
        return match ? Number(match[1]) : 0;
      });
    const nextSequence = Math.max(0, ...existingSequences) + 1;
    return formatComplaintNumber(nextSequence);
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

    const priorityRadios = Array.from(
      document.querySelectorAll("input[name='priority']"),
    );

    priorityRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!categorySelect) {
          return;
        }

        const category = categorySelect.value;
        const selectedHigh = radio.value === "high" && radio.checked;
        if (!highPriorityCategories.includes(category) && selectedHigh) {
          toggleHighPriorityConfirmation(true);
        } else {
          toggleHighPriorityConfirmation(false);
        }
        updatePriorityHelpText(category, selectedHigh);
      });
    });

    if (categorySelect) {
      setPriorityControls(categorySelect.value);
    }
  }

  initPriorityControlEvents();
  loadComplaintEligibility();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAttachmentErrors();

    const title = document.getElementById("title").value.trim();
    const category = document.getElementById("categoryId").value;
    const categoryOther = categoryOtherText?.value.trim() || "";
    const displayCategory = formatOtherValue(category, categoryOther);
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
    const purok = document.getElementById("purokId").value;
    const date = document.getElementById("incidentDate").value;
    const time = document.getElementById("incidentTime").value;
    const selectedPriority = document.querySelector(
      "input[name='priority']:checked",
    ).value;
    const priority = highPriorityCategories.includes(category)
      ? "high"
      : selectedPriority;
    const anonymous = document.getElementById("anonymous").checked;
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

    if ((date && !time) || (!date && time)) {
      showNotification(
        "Please provide both incident date and time, or leave both empty.",
        "error",
      );
      return;
    }

    if (
      priority === "high" &&
      !highPriorityCategories.includes(category) &&
      !confirmHighPriority?.checked
    ) {
      showNotification(
        "Please confirm this is a high priority concern before submitting.",
        "error",
      );
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

    const id = generateComplaintNumber();
    refId.textContent = id;

    const submittedAt = new Date();
    const displayDate = date || submittedAt.toISOString().slice(0, 10);
    const displayTime = time
      ? formatDisplayTime(time)
      : formatDisplayTime(
          `${String(submittedAt.getHours()).padStart(2, "0")}:${String(
            submittedAt.getMinutes(),
          ).padStart(2, "0")}`,
        );

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
    formData.append("anonymous", anonymous ? "true" : "false");
    if (image) {
      formData.append("image", image);
    }
    if (video) {
      formData.append("video", video);
    }

    const complaint = {
      id,
      referenceId: id,
      title,
      category: displayCategory,
      categorySpecify: category === "Other" ? categoryOther : "",
      priority: priority === "high" ? "High" : "Normal",
      status: "Pending",
      date: displayDate,
      time: displayTime,
      purok,
      details,
      respondent_name: respondentName,
      respondent_contact_number: respondentContactNumber,
      respondent_purok: respondentPurok,
      confidential: anonymous ? "Yes (Public-hidden)" : "No",
      anonymous,
      attachments: [image?.name, video?.name].filter(Boolean),
      responses: [],
      history: [
        {
          label: "Submitted",
          status: "Pending",
          date: displayDate,
          time: displayTime,
        },
      ],
      submittedAt: submittedAt.toISOString(),
    };

    let submissionSucceeded = false;

    try {
      const response = await api.createComplaint(formData);
      if (!response.success) {
        throw new Error(response.message || "Complaint submission failed.");
      }

      submissionSucceeded = true;
      const confirmedId = response?.data?.id;
      if (confirmedId) {
        refId.textContent = confirmedId;
        complaint.id = confirmedId;
        complaint.referenceId = confirmedId;
      }
      showNotification(
        "Your complaint has been submitted successfully.",
        "success",
      );
      form.reset();
      setOtherCategoryControls(false);
    } catch (error) {
      console.error(error);
      saveComplaint(complaint);
      showNotification(
        "The server was unavailable, so your complaint was saved locally and will be available once the service is reachable again.",
        "warning",
      );
    }

    if (submissionSucceeded) {
      summaryBlock.replaceChildren();
      [
        ["Category", displayCategory],
        ["Purok", purok],
        ["Priority", priority === "high" ? "High Priority" : "Normal"],
        [
          "Incident",
          date ? `${date}${time ? " at " + formatDisplayTime(time) : ""}` : "Not specified",
        ],
        ["Hidden identity", anonymous ? "Yes" : "No"],
      ].forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        paragraph.appendChild(strong);
        paragraph.append(document.createTextNode(value));
        summaryBlock.appendChild(paragraph);
      });
      summaryBlock.hidden = false;

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
