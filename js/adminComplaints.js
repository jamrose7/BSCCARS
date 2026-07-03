"use strict";

let _lastFocusedButton = null;
let _currentComplaintId = null;
const archivedComplaintsKey = "bsccarsArchivedComplaints";
const adminResponseMaxLength = 1500;
let liveComplaints = [];
let activeStatusFilter = "";
let activePriorityFilter = "";
document.addEventListener("DOMContentLoaded", () => {
  initSignOut();
  initModalBackdrop();
  initEscapeKey();
  initComplaintFilters();
  initCharacterCounter();
  initStatFilters();
  initRespondentEditor();
  loadLiveComplaints();
  renderArchivedComplaints();
});

function initSignOut() {
  const signoutBtn = document.querySelector(".signout");
  if (!signoutBtn) return;

  signoutBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (confirmed) {
      window.location.href = "index.html";
    }
  });
}

function viewComplaint(btn) {
  const modal = document.getElementById("complaintModal");
  if (!modal || !btn) return;

  _lastFocusedButton = btn;

  const d = btn.dataset;
  _currentComplaintId = formatComplaintNumber(d.id || "");

  setTextById("modalTitle", `${_currentComplaintId || "—"} (Admin View)`);

  setTextById("complainantName", d.name);
  renderRespondentDetails(d);
  setTextById("complaintCategory", d.category);
  const sourceSelect = document.getElementById("complaintSourceSelect");
  if (sourceSelect) {
    const source = splitOtherDisplayValue(d.source || "Digital Submission");
    sourceSelect.value = source.base || "Digital Submission";
    setSourceOtherControls(sourceSelect.value === "Other", source.specify);
  }
  setTextById("complaintPriority", d.priority);
  setTextById("complaintConfidential", d.confidential);
  setTextById("complaintTitle", d.title);
  setTextById("complaintDetails", d.details);

  const statusSelect = document.getElementById("statusSelect");
  if (statusSelect) {
    statusSelect.value = d.status || "pending";
  }

  setUnderReviewBadge(d.status);
  toggleConfirmationBanner(false);

  const textarea = document.getElementById("adminResponse");
  if (textarea) {
    textarea.value = "";
    updateCharCounter(textarea);
  }

  buildEvidence(d.image, d.video);

  buildNotes(d.note);
  loadProceedingsTimeline(_currentComplaintId);

  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  const modalTitle = document.getElementById("modalTitle");
  if (modalTitle) {
    modalTitle.setAttribute("tabindex", "-1");
    modalTitle.focus();
  }
}

function closeComplaintModal() {
  const modal = document.getElementById("complaintModal");
  if (!modal) return;

  modal.classList.remove("show");
  document.body.style.overflow = "";

  if (_lastFocusedButton) {
    _lastFocusedButton.focus();
    _lastFocusedButton = null;
  }

  _currentComplaintId = null;
}

function categoryMatchesFilter(category, selectedCategory) {
  if (!selectedCategory) return true;
  if (selectedCategory === "Other") {
    return category === "Other" || category.startsWith("Other:");
  }
  return category === selectedCategory;
}

function splitOtherDisplayValue(value) {
  const raw = String(value || "").trim();
  if (raw.toLowerCase().startsWith("other:")) {
    return {
      base: "Other",
      specify: raw.slice(raw.indexOf(":") + 1).trim(),
    };
  }
  return { base: raw, specify: "" };
}

function formatOtherDisplayValue(baseValue, specifyText) {
  return baseValue === "Other" && specifyText
    ? `Other: ${specifyText}`
    : baseValue;
}

function getRespondentFields(data = {}) {
  return {
    respondent_name: data.respondent_name || data.respondentName || "",
    respondent_contact_number:
      data.respondent_contact_number || data.respondentContactNumber || "",
    respondent_address: data.respondent_address || data.respondentAddress || "",
  };
}

function respondentSummaryText(fields) {
  const parts = [
    fields.respondent_name,
    fields.respondent_contact_number,
    fields.respondent_address,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "No respondent details yet.";
}

function setRespondentEditVisible(visible) {
  const editGroup = document.getElementById("respondentEditGroup");
  const editButton = document.getElementById("editRespondentBtn");
  if (editGroup) {
    editGroup.style.display = visible ? "grid" : "none";
  }
  if (editButton) {
    editButton.style.display = visible ? "none" : "inline-flex";
  }
}

function populateRespondentInputs(fields) {
  const nameInput = document.getElementById("respondentNameInput");
  const contactInput = document.getElementById("respondentContactInput");
  const addressInput = document.getElementById("respondentAddressInput");
  if (nameInput) nameInput.value = fields.respondent_name || "";
  if (contactInput) contactInput.value = fields.respondent_contact_number || "";
  if (addressInput) addressInput.value = fields.respondent_address || "";
}

function renderRespondentDetails(data = {}) {
  const fields = getRespondentFields(data);
  const display = document.getElementById("respondentDisplay");
  const editButton = document.getElementById("editRespondentBtn");
  if (display) {
    display.textContent = respondentSummaryText(fields);
  }
  if (editButton) {
    editButton.textContent = fields.respondent_name
      ? "Edit respondent details"
      : "Add respondent details";
  }
  populateRespondentInputs(fields);
  setRespondentEditVisible(false);
}

async function saveRespondentDetails() {
  if (!_currentComplaintId || !_lastFocusedButton) {
    alert("Please select a complaint before editing respondent details.");
    return;
  }

  const fields = {
    respondent_name:
      document.getElementById("respondentNameInput")?.value.trim() || "",
    respondent_contact_number:
      document.getElementById("respondentContactInput")?.value.trim() || "",
    respondent_address:
      document.getElementById("respondentAddressInput")?.value.trim() || "",
  };

  if (fields.respondent_name.length > 255) {
    alert("Respondent full name must be 255 characters or fewer.");
    return;
  }
  if (fields.respondent_contact_number.length > 20) {
    alert("Respondent contact number must be 20 characters or fewer.");
    return;
  }

  if (typeof api !== "undefined" && api.updateComplaintRespondent) {
    try {
      const response = await api.updateComplaintRespondent(
        _currentComplaintId,
        fields,
      );
      const updated = response?.data || fields;
      Object.assign(fields, getRespondentFields(updated));
    } catch (error) {
      alert(error.message || "Unable to save respondent details.");
      return;
    }
  }

  Object.entries(fields).forEach(([key, value]) => {
    _lastFocusedButton.dataset[key] = value;
  });

  const complaint = liveComplaints.find(
    (item) => item.id === _currentComplaintId,
  );
  if (complaint) {
    Object.assign(complaint, fields);
  }

  renderRespondentDetails(fields);
}

function setSourceOtherControls(isOther, specifyText = "") {
  const group = document.getElementById("complaintSourceOtherGroup");
  const input = document.getElementById("complaintSourceOtherText");
  if (group) {
    group.style.display = isOther ? "block" : "none";
  }
  if (input) {
    input.disabled = !isOther;
    input.required = isOther;
    input.value = isOther ? specifyText : "";
  }
}

function filterComplaintRows() {
  const filter = document.getElementById("adminCategoryFilter");
  const statusFilter = document.getElementById("adminStatusFilter");
  const tbody = document.getElementById("complaintsBody");
  const emptyState = document.getElementById("emptyStateRow");
  if (!filter || !tbody) {
    return;
  }

  const selectedCategory = filter.value;
  const selectedStatus = statusFilter?.value || activeStatusFilter;
  const rows = Array.from(tbody.querySelectorAll("tr")).filter(
    (row) => row.id !== "emptyStateRow",
  );

  let visibleCount = 0;
  rows.forEach((row) => {
    const button = row.querySelector("button[data-category]");
    const category =
      button?.dataset.category || row.cells[4]?.textContent || "";
    const status = normalizeStatus(button?.dataset.status || "");
    const priority = button?.dataset.priority || "";
    const shouldShow =
      categoryMatchesFilter(category, selectedCategory) &&
      (!selectedStatus || status === selectedStatus) &&
      (!activePriorityFilter ||
        priority.toLowerCase() === activePriorityFilter.toLowerCase());
    row.style.display = shouldShow ? "" : "none";
    if (shouldShow) {
      visibleCount += 1;
    }
  });

  if (emptyState) {
    emptyState.style.display = visibleCount ? "none" : "table-row";
  }
}

function initComplaintFilters() {
  const filter = document.getElementById("adminCategoryFilter");
  if (!filter) {
    return;
  }

  filter.addEventListener("change", filterComplaintRows);
  const statusFilter = document.getElementById("adminStatusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      activeStatusFilter = statusFilter.value;
      activePriorityFilter = "";
      filterComplaintRows();
    });
  }

  const sourceSelect = document.getElementById("complaintSourceSelect");
  if (sourceSelect) {
    sourceSelect.addEventListener("change", () => {
      setSourceOtherControls(sourceSelect.value === "Other");
    });
  }
}

function initRespondentEditor() {
  const editButton = document.getElementById("editRespondentBtn");
  const saveButton = document.getElementById("saveRespondentBtn");
  const cancelButton = document.getElementById("cancelRespondentBtn");

  if (editButton) {
    editButton.addEventListener("click", () => setRespondentEditVisible(true));
  }
  if (saveButton) {
    saveButton.addEventListener("click", saveRespondentDetails);
  }
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      if (_lastFocusedButton) {
        renderRespondentDetails(_lastFocusedButton.dataset);
      } else {
        setRespondentEditVisible(false);
      }
    });
  }
}

function initStatFilters() {
  const params = new URLSearchParams(window.location.search);
  activeStatusFilter = normalizeStatus(params.get("status") || "");
  activePriorityFilter = params.get("priority") || "";

  const statusFilter = document.getElementById("adminStatusFilter");
  if (statusFilter && activeStatusFilter) {
    statusFilter.value = activeStatusFilter;
  }

  document.querySelectorAll(".complaint-stat-filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeStatusFilter = normalizeStatus(button.dataset.filterStatus || "");
      activePriorityFilter = button.dataset.filterPriority || "";
      if (statusFilter) {
        statusFilter.value = activeStatusFilter;
      }
      filterComplaintRows();
    });
  });
}

function normalizeStatus(status) {
  const key = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (["resolved", "closed", "completed"].includes(key)) return "resolved";
  if (["in-progress", "progress", "ongoing"].includes(key))
    return "in-progress";
  return key ? "pending" : "";
}

function statusLabel(status) {
  return (
    {
      pending: "Pending",
      "in-progress": "In Progress",
      resolved: "Resolved",
    }[normalizeStatus(status)] || "Pending"
  );
}

function setStat(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

async function loadLiveComplaints() {
  if (typeof api === "undefined" || !api.getComplaints) {
    renderStatsFromRows();
    filterComplaintRows();
    return;
  }

  try {
    const response = await api.getComplaints();
    liveComplaints = Array.isArray(response?.data) ? response.data : [];
    renderComplaintTable(liveComplaints);
    renderComplaintStats(liveComplaints);
    filterComplaintRows();
  } catch (error) {
    console.warn(
      "Unable to load live complaints. Showing existing rows.",
      error,
    );
    renderStatsFromRows();
    filterComplaintRows();
  }
}

function renderComplaintStats(complaints) {
  setStat("complaintsTotal", complaints.length);
  setStat(
    "complaintsPending",
    complaints.filter((c) => normalizeStatus(c.status) === "pending").length,
  );
  setStat(
    "complaintsProgress",
    complaints.filter((c) => normalizeStatus(c.status) === "in-progress")
      .length,
  );
  setStat(
    "complaintsResolved",
    complaints.filter((c) => normalizeStatus(c.status) === "resolved").length,
  );
  setStat(
    "complaintsHighPriority",
    complaints.filter((c) => String(c.priority || "").toLowerCase() === "high")
      .length,
  );
}

function renderStatsFromRows() {
  const rows = Array.from(
    document.querySelectorAll("#complaintsBody tr"),
  ).filter((row) => row.id !== "emptyStateRow");
  const complaints = rows
    .map((row) => row.querySelector("button[data-id]")?.dataset)
    .filter(Boolean);
  renderComplaintStats(complaints);
}

function renderComplaintTable(complaints) {
  const tbody = document.getElementById("complaintsBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  complaints.forEach((complaint) => {
    tbody.appendChild(
      createComplaintRow(normalizeComplaintForTable(complaint)),
    );
  });

  const emptyRow = document.createElement("tr");
  emptyRow.id = "emptyStateRow";
  emptyRow.style.display = complaints.length ? "none" : "table-row";
  emptyRow.innerHTML = `
    <td colspan="10" style="text-align: center; padding: 32px; color: rgba(255, 255, 255, 0.45); font-style: italic;">
      No complaints found.
    </td>
  `;
  tbody.appendChild(emptyRow);
}

function normalizeComplaintForTable(complaint) {
  const complainant = complaint.complainant || {};
  const attachments = Array.isArray(complaint.attachments)
    ? complaint.attachments
    : [];
  const imageAttachment = attachments.find((item) => item.type === "image");
  const videoAttachment = attachments.find((item) => item.type === "video");
  return {
    id: complaint.id,
    name:
      complainant.fullName ||
      complaint.resident ||
      complaint.name ||
      "Unknown Resident",
    firstName: complainant.firstName || "",
    middleName: complainant.middleName || "",
    lastName: complainant.lastName || "",
    category: complaint.category || "Uncategorized",
    source: complaint.source || "Digital Submission",
    priority: complaint.priority || "Normal",
    status: normalizeStatus(complaint.status) || "pending",
    title: complaint.title || "Untitled complaint",
    details: complaint.details || "",
    respondent_name: complaint.respondent_name || "",
    respondent_contact_number: complaint.respondent_contact_number || "",
    respondent_address: complaint.respondent_address || "",
    confidential: complaint.confidential || "No",
    image: imageAttachment?.path || imageAttachment?.originalName || "",
    video: videoAttachment?.path || videoAttachment?.originalName || "",
    note: complaint.adminNotes || "",
    respondent_email:
      complaint.respondent_email || complaint.respondentEmail || "",
  };
}

function initModalBackdrop() {
  const modal = document.getElementById("complaintModal");
  if (!modal) return;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeComplaintModal();
    }
  });
}

function initEscapeKey() {
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("complaintModal");
    if (e.key === "Escape" && modal && modal.classList.contains("show")) {
      closeComplaintModal();
    }
  });
}

function buildEvidence(image, video) {
  const container = document.getElementById("evidenceContainer");
  if (!container) return;

  container.innerHTML = "";

  const hasImage = image && image.trim() !== "";
  const hasVideo = video && video.trim() !== "";

  if (!hasImage && !hasVideo) {
    const msg = document.createElement("p");
    msg.style.cssText =
      "color: rgba(255,255,255,0.45); font-style: italic; margin: 0;";
    msg.textContent = "No evidence attached.";
    container.appendChild(msg);
    return;
  }

  if (hasImage) {
    container.appendChild(createEvidenceCard(image.trim(), "image"));
  }
  if (hasVideo) {
    container.appendChild(createEvidenceCard(video.trim(), "video"));
  }
}

function displayFileName(filePath) {
  return (
    String(filePath || "")
      .split(/[\\/]/)
      .pop() || filePath
  );
}

function createEvidenceCard(filename, type) {
  const isImage = type === "image";
  const actionLabel = isImage ? "View Image" : "Play Video";
  const removeLabel = isImage ? "Remove Image" : "Remove Video";
  const actionFn = isImage ? "viewImage" : "playVideo";

  const card = document.createElement("div");
  card.className = "evidence-item";
  card.dataset.filename = filename;

  const fileLabel = document.createElement("div");
  fileLabel.className = "evidence-file";
  fileLabel.textContent = displayFileName(filename);

  const actions = document.createElement("div");
  actions.className = "evidence-actions";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "btn-evidence";
  viewBtn.textContent = actionLabel;
  viewBtn.setAttribute("aria-label", `${actionLabel}: ${filename}`);
  viewBtn.addEventListener("click", () => {
    if (isImage) viewImage(filename);
    else playVideo(filename);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-evidence btn-danger";
  removeBtn.textContent = removeLabel;
  removeBtn.setAttribute("aria-label", `${removeLabel}: ${filename}`);
  removeBtn.addEventListener("click", () => removeEvidence(filename, card));

  actions.appendChild(viewBtn);
  actions.appendChild(removeBtn);
  card.appendChild(fileLabel);
  card.appendChild(actions);

  return card;
}

function viewImage(filename) {
  window.open(filename, "_blank", "noopener");
}

function playVideo(filename) {
  window.open(filename, "_blank", "noopener");
}

function removeEvidence(filename, cardElement) {
  const confirmed = window.confirm(
    `Are you sure you want to remove "${filename}"?`,
  );
  if (!confirmed) return;

  if (cardElement && cardElement.parentElement) {
    cardElement.remove();
  }

  const container = document.getElementById("evidenceContainer");
  if (container && container.children.length === 0) {
    const msg = document.createElement("p");
    msg.style.cssText =
      "color: rgba(255,255,255,0.45); font-style: italic; margin: 0;";
    msg.textContent = "No evidence attached.";
    container.appendChild(msg);
  }
}

function buildNotes(noteStr) {
  const list = document.getElementById("internalNotesList");
  if (!list) return;

  list.innerHTML = "";

  if (noteStr && noteStr.trim() !== "") {
    const note = createNoteElement(noteStr.trim());
    list.appendChild(note);
  }
}

function stageLabel(stage) {
  return (
    {
      first_mediation: "First Mediation",
      second_mediation: "Second Mediation",
      conciliation: "Conciliation",
      cfa_issued: "CFA Issued",
    }[String(stage || "first_mediation").trim()] || "First Mediation"
  );
}

function outcomeLabel(outcome) {
  return (
    {
      pending: "Pending",
      respondent_appeared: "Respondent Appeared",
      respondent_absent: "Respondent Absent",
      settled: "Settled",
      escalated: "Escalated",
      unresolved: "Unresolved",
    }[
      String(outcome || "pending")
        .trim()
        .toLowerCase()
    ] || "Pending"
  );
}

function outcomeBadgeClass(outcome) {
  return (
    {
      pending: "timeline-badge pending",
      respondent_appeared: "timeline-badge appeared",
      respondent_absent: "timeline-badge absent",
      settled: "timeline-badge settled",
      escalated: "timeline-badge escalated",
      unresolved: "timeline-badge pending",
    }[
      String(outcome || "pending")
        .trim()
        .toLowerCase()
    ] || "timeline-badge pending"
  );
}

function formatTimelineDate(value) {
  if (!value) return "Not set";
  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return String(value);
  }
  return dateValue.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderProceedingsTimeline(notices) {
  const list = document.getElementById("timelineList");
  const emptyState = document.getElementById("timelineEmpty");
  if (!list) return;

  list.innerHTML = "";
  if (!Array.isArray(notices) || !notices.length) {
    if (emptyState) {
      emptyState.style.display = "block";
    }
    return;
  }

  if (emptyState) {
    emptyState.style.display = "none";
  }

  notices.forEach((notice) => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    const stageText = stageLabel(notice.stage || "first_mediation");
    const outcomeText = outcomeLabel(notice.outcome || "pending");
    const dateText = formatTimelineDate(
      notice.hearing_date ||
        notice.hearingDate ||
        notice.created_at ||
        notice.createdAt,
    );
    const servedText = notice.notice_served_method
      ? `Served via ${notice.notice_served_method.replace("_", " ")}`
      : "Service pending";

    item.innerHTML = `
      <div class="timeline-item-main">
        <div class="timeline-stage">${escapeHtml(stageText)}</div>
        <div class="timeline-date">${escapeHtml(dateText)}</div>
        <div class="timeline-served">${escapeHtml(servedText)}</div>
      </div>
      <div class="${outcomeBadgeClass(notice.outcome || "pending")}">${escapeHtml(outcomeText)}</div>
    `;
    list.appendChild(item);
  });
}

function updateProceedingsActions(notices) {
  const nextActionButton = document.getElementById("timelineNextActionBtn");
  const issueCfaButton = document.getElementById("issueCfaButton");
  if (!nextActionButton || !issueCfaButton) return;

  const latestNotice =
    Array.isArray(notices) && notices.length
      ? notices[notices.length - 1]
      : null;
  const latestStage = latestNotice?.stage || "first_mediation";
  const latestOutcome = String(latestNotice?.outcome || "pending")
    .trim()
    .toLowerCase();

  if (
    latestOutcome === "respondent_absent" &&
    (latestStage === "first_mediation" || latestStage === "second_mediation")
  ) {
    nextActionButton.style.display = "inline-flex";
    nextActionButton.textContent =
      latestStage === "first_mediation"
        ? "Create Second Mediation Notice"
        : "Create Conciliation Notice";
    nextActionButton.onclick = () => {
      openProceedingsNoticeForStage(
        latestStage === "first_mediation" ? "second_mediation" : "conciliation",
      );
    };
  } else {
    nextActionButton.style.display = "none";
  }

  const cfaEligible =
    Array.isArray(notices) &&
    notices.some((notice) => {
      const stage = String(notice.stage || "").trim();
      const outcome = String(notice.outcome || "pending")
        .trim()
        .toLowerCase();
      return (
        stage === "conciliation" &&
        ["respondent_absent", "escalated", "pending", "unresolved"].includes(
          outcome,
        )
      );
    });

  issueCfaButton.style.display = cfaEligible ? "inline-flex" : "none";
  issueCfaButton.onclick = issueCfaNotice;
}

async function loadProceedingsTimeline(complaintId) {
  const list = document.getElementById("timelineList");
  const emptyState = document.getElementById("timelineEmpty");
  if (!list) return;

  list.innerHTML = "";
  if (emptyState) {
    emptyState.style.display = "block";
    emptyState.textContent = "Loading proceedings…";
  }

  try {
    if (typeof api !== "undefined" && api.get) {
      const response = await api.get(
        `/complaints/${complaintId}/hearing-notices`,
      );
      const notices = Array.isArray(response?.data) ? response.data : [];
      renderProceedingsTimeline(notices);
      renderProceedingsSummary(notices);
      renderModalWorkflowSummary(notices);
      updateProceedingsActions(notices);
      return;
    }
  } catch (error) {
    console.warn("Unable to load proceedings timeline.", error);
  }

  if (emptyState) {
    emptyState.style.display = "block";
    emptyState.textContent = "No proceedings have been recorded yet.";
  }
}

function renderProceedingsSummary(notices) {
  const summaryText = document.getElementById("timelineSummaryText");
  if (!summaryText) return;

  if (!Array.isArray(notices) || !notices.length) {
    summaryText.textContent = "No hearing notices recorded yet.";
    return;
  }

  const latestNotice = notices[notices.length - 1];
  const stageText = stageLabel(latestNotice.stage || "first_mediation");
  const outcomeText = outcomeLabel(latestNotice.outcome || "pending");
  const servedText = latestNotice.notice_served_method
    ? `Served via ${String(latestNotice.notice_served_method)
        .replace(/_/g, " ")
        .trim()}`
    : "Service pending";

  summaryText.textContent = `${stageText} · ${outcomeText} · ${servedText}`;
}

function renderModalWorkflowSummary(notices) {
  const summaryEl = document.getElementById("modalWorkflowSummaryText");
  if (!summaryEl) return;

  if (!Array.isArray(notices) || !notices.length) {
    summaryEl.textContent = "No hearing activity yet.";
    return;
  }

  const latestNotice = notices[notices.length - 1];
  const stageText = stageLabel(latestNotice.stage || "first_mediation");
  const outcomeText = outcomeLabel(latestNotice.outcome || "pending");
  const servedText = latestNotice.notice_served_method
    ? `Served via ${String(latestNotice.notice_served_method)
        .replace(/_/g, " ")
        .trim()}`
    : "Service pending";

  summaryEl.textContent = `${stageText} · ${outcomeText} · ${servedText}`;
}

function openProceedingsNoticeForStage(stage) {
  if (!_currentComplaintId || !_lastFocusedButton) {
    alert("Please select a complaint before creating a follow-up notice.");
    return;
  }

  const d = _lastFocusedButton.dataset;
  const noticeData = {
    id: formatComplaintNumber(d.id || ""),
    name: d.name || "",
    category: d.category || "",
    title: d.title || "",
    source:
      document.getElementById("complaintSourceSelect")?.value || d.source || "",
    details: d.details || "",
    respondentEmail: d.respondent_email || d.respondentEmail || "",
    confidential: d.confidential || "",
    stage,
  };

  sessionStorage.setItem(
    "selectedComplaintForNotice",
    JSON.stringify(noticeData),
  );
  window.location.href = "adminComplaintNotice.html";
}

async function issueCfaNotice() {
  if (!_currentComplaintId) {
    alert("Please select a complaint before issuing a CFA.");
    return;
  }

  if (typeof api !== "undefined" && api.post) {
    try {
      const response = await api.post("/hearing-notices", {
        complaint_id: _currentComplaintId,
        stage: "cfa_issued",
        outcome: "pending",
      });
      const createdNotice = response?.data || response;
      if (createdNotice?.id) {
        const d = _lastFocusedButton?.dataset || {};
        const noticeData = {
          id: formatComplaintNumber(d.id || ""),
          name: d.name || "",
          category: d.category || "",
          title: d.title || "",
          source:
            document.getElementById("complaintSourceSelect")?.value ||
            d.source ||
            "",
          details: d.details || "",
          respondentEmail: d.respondent_email || d.respondentEmail || "",
          confidential: d.confidential || "",
          stage: "cfa_issued",
          noticeId: createdNotice.id,
        };
        sessionStorage.setItem(
          "selectedComplaintForNotice",
          JSON.stringify(noticeData),
        );
        window.location.href = "adminComplaintNotice.html";
        return;
      }
    } catch (error) {
      alert(error.message || "Unable to issue CFA notice.");
      return;
    }
  }

  alert("CFA notice generation is unavailable in the current offline mode.");
}

function addInternalNote() {
  const input = document.getElementById("newNoteInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  const list = document.getElementById("internalNotesList");
  if (!list) return;

  const note = createNoteElement(text);
  note.style.marginTop = "8px";
  list.appendChild(note);

  input.value = "";
  input.focus();
}

function createNoteElement(text) {
  const div = document.createElement("div");
  div.className = "internal-note";
  div.textContent = text;
  return div;
}

function onStatusChange() {
  toggleConfirmationBanner(true);
}

function setUnderReviewBadge(status) {
  const badge = document.getElementById("underReviewBadge");
  if (!badge) return;
  badge.style.display = "none";
}

function toggleConfirmationBanner(visible) {
  const banner = document.getElementById("confirmationBanner");
  if (!banner) return;
  banner.style.display = visible ? "flex" : "none";
}

function saveAction() {
  const textarea = document.getElementById("adminResponse");
  const statusSelect = document.getElementById("statusSelect");

  if (!textarea || !statusSelect) return;

  const adminResponse = textarea.value.trim();
  const status = statusSelect.value;

  if (!adminResponse) {
    alert("Please enter an official response before saving.");
    textarea.focus();
    return;
  }

  if (adminResponse.length > adminResponseMaxLength) {
    alert(
      `Admin response must not exceed ${adminResponseMaxLength} characters.`,
    );
    textarea.focus();
    return;
  }

  const idLabel = _currentComplaintId ? _currentComplaintId : "This complaint";

  const statusDisplay = {
    pending: "Pending",
    "in-progress": "In Progress",
    resolved: "Resolved",
  };

  const sourceSelect = document.getElementById("complaintSourceSelect");
  const sourceOtherText = document.getElementById("complaintSourceOtherText");
  const sourceBase = sourceSelect ? sourceSelect.value : "Unknown";
  const sourceSpecify = sourceOtherText?.value.trim() || "";

  if (sourceBase === "Other" && !sourceSpecify) {
    alert("Please specify the Other intake source.");
    sourceOtherText?.focus();
    return;
  }

  const updatedSource = formatOtherDisplayValue(sourceBase, sourceSpecify);

  const finish = () => {
    alert(
      `Action saved!\n\n` +
        `${idLabel}\n` +
        `New Status: ${statusDisplay[status] || status}\n` +
        `Source: ${updatedSource}\n` +
        `Response: ${adminResponse}`,
    );
    if (_lastFocusedButton) {
      _lastFocusedButton.dataset.status = status;
      const row = _lastFocusedButton.closest("tr");
      const pill = row?.querySelector("[data-status-pill]");
      if (pill) {
        pill.className = statusClassForRow(status);
        pill.textContent = statusDisplay[status] || status;
      }
      const complaint = liveComplaints.find(
        (item) => item.id === _currentComplaintId,
      );
      if (complaint) {
        complaint.status = status;
        complaint.source = updatedSource;
        renderComplaintStats(liveComplaints);
      } else {
        renderStatsFromRows();
      }
      _lastFocusedButton.dataset.source = updatedSource;
      const rowCells = row?.querySelectorAll("td");
      if (rowCells?.[5]) {
        rowCells[5].textContent = updatedSource;
      }
      filterComplaintRows();
    }
    closeComplaintModal();
  };

  if (
    typeof api !== "undefined" &&
    api.updateComplaintStatus &&
    _currentComplaintId
  ) {
    api
      .updateComplaintStatus(_currentComplaintId, status, adminResponse, {
        source: sourceBase,
        sourceSpecify,
      })
      .then(finish)
      .catch((error) => {
        alert(error.message || "Unable to save admin response.");
      });
    return;
  }

  finish();
}

function getArchivedComplaints() {
  try {
    return JSON.parse(localStorage.getItem(archivedComplaintsKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveArchivedComplaints(complaints) {
  localStorage.setItem(archivedComplaintsKey, JSON.stringify(complaints));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getComplaintDataFromButton(button) {
  const data = button.dataset;
  return {
    id: formatComplaintNumber(data.id || ""),
    name: data.name || "",
    category: data.category || "",
    source: data.source || "",
    priority: data.priority || "",
    status: data.status || "pending",
    title: data.title || "",
    details: data.details || "",
    confidential: data.confidential || "",
    image: data.image || "",
    video: data.video || "",
    note: data.note || "",
  };
}

async function archiveCurrentComplaint() {
  if (!_lastFocusedButton || !_currentComplaintId) {
    alert("Please select a complaint before archiving.");
    return;
  }

  const confirmed = confirm(
    `Archive ${_currentComplaintId}? It will be hidden from the active complaints list but kept for records.`,
  );
  if (!confirmed) {
    return;
  }

  if (typeof api !== "undefined" && api.archiveComplaint) {
    try {
      await api.archiveComplaint(_currentComplaintId);
    } catch (error) {
      alert(error.message || "Unable to archive complaint.");
      return;
    }
  }

  const archived = getArchivedComplaints();
  const complaint = {
    ...getComplaintDataFromButton(_lastFocusedButton),
    archivedAt: new Date().toISOString(),
  };
  const nextArchive = archived.filter((item) => item.id !== complaint.id);
  nextArchive.unshift(complaint);
  saveArchivedComplaints(nextArchive);

  const row = _lastFocusedButton.closest("tr");
  if (row) {
    row.remove();
  }
  liveComplaints = liveComplaints.filter(
    (item) => item.id !== _currentComplaintId,
  );

  renderComplaintStats(
    liveComplaints.length ? liveComplaints : getActiveComplaintsFromRows(),
  );
  renderArchivedComplaints();
  closeComplaintModal();
  window.BSCCARSNotifications?.add?.({
    title: "Complaint archived",
    message: `${_currentComplaintId} was moved to the archive and can be restored later.`,
  });
}

function getActiveComplaintsFromRows() {
  return Array.from(document.querySelectorAll("#complaintsBody tr"))
    .filter((row) => row.id !== "emptyStateRow")
    .map((row) => row.querySelector("button[data-id]")?.dataset)
    .filter(Boolean);
}

async function restoreArchivedComplaint(id) {
  const archived = getArchivedComplaints();
  const complaint = archived.find((item) => item.id === id);
  if (!complaint) {
    return;
  }

  if (typeof api !== "undefined" && api.restoreComplaint) {
    try {
      await api.restoreComplaint(id);
    } catch (error) {
      alert(error.message || "Unable to restore complaint.");
      return;
    }
  }

  const tbody = document.getElementById("complaintsBody");
  if (tbody) {
    const emptyStateRow = document.getElementById("emptyStateRow");
    tbody.insertBefore(createComplaintRow(complaint), emptyStateRow || null);
  }

  saveArchivedComplaints(archived.filter((item) => item.id !== id));
  liveComplaints.unshift(complaint);
  renderComplaintStats(
    liveComplaints.length ? liveComplaints : getActiveComplaintsFromRows(),
  );
  renderArchivedComplaints();
  window.BSCCARSNotifications?.add?.({
    title: "Complaint restored",
    message: `${formatComplaintNumber(id)} was restored from the archive.`,
  });
}

async function permanentlyDeleteArchivedComplaint(id) {
  const archived = getArchivedComplaints();
  const complaint = archived.find((item) => item.id === id);
  if (!complaint) {
    return;
  }

  const confirmed = confirm(
    `Permanently delete ${formatComplaintNumber(id)} from archived complaints? This cannot be undone.`,
  );
  if (!confirmed) {
    return;
  }

  if (typeof api !== "undefined" && api.deleteComplaint) {
    try {
      await api.deleteComplaint(id);
    } catch (error) {
      alert(error.message || "Unable to permanently delete complaint.");
      return;
    }
  }

  saveArchivedComplaints(archived.filter((item) => item.id !== id));
  renderArchivedComplaints();
  window.BSCCARSNotifications?.add?.({
    title: "Archived complaint permanently deleted",
    message: `${formatComplaintNumber(id)} was permanently deleted from the archive.`,
  });
}

function createComplaintRow(complaint) {
  const row = document.createElement("tr");
  const nameParts = complaint.name.split(" ").filter(Boolean);
  const firstName = complaint.firstName || nameParts[0] || "-";
  const lastName = complaint.lastName || nameParts[nameParts.length - 1] || "-";
  const middleName =
    complaint.middleName ||
    (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "-");
  const normalized = normalizeStatus(complaint.status) || "pending";
  const priorityClass =
    complaint.priority === "High" ? "priority-high" : "priority-normal";

  row.innerHTML = `
    <td>${escapeHtml(formatComplaintNumber(complaint.id))}</td>
    <td>${escapeHtml(firstName)}</td>
    <td>${escapeHtml(lastName)}</td>
    <td>${escapeHtml(middleName)}</td>
    <td>${escapeHtml(complaint.category)}</td>
    <td>${escapeHtml(complaint.source)}</td>
    <td><span class="${priorityClass}">${escapeHtml(complaint.priority)}</span></td>
    <td>${escapeHtml(complaint.confidential)}</td>
    <td><span data-status-pill class="${statusClassForRow(normalized)}">${statusLabel(normalized)}</span></td>
    <td></td>
  `;

  const actionCell = row.lastElementChild;
  const button = document.createElement("button");
  button.className = "btn-action";
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `View complaint ${formatComplaintNumber(complaint.id)}`,
  );
  button.textContent = "View";
  Object.entries(complaint).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  button.addEventListener("click", () => viewComplaint(button));
  actionCell.appendChild(button);

  return row;
}

function statusClassForRow(status) {
  return (
    {
      pending: "status-pending",
      "in-progress": "status-progress",
      resolved: "status-resolved",
    }[normalizeStatus(status)] || "status-pending"
  );
}

function renderArchivedComplaints() {
  const archiveList = document.getElementById("complaintsArchiveList");
  if (!archiveList) {
    return;
  }

  const archived = getArchivedComplaints();
  if (!archived.length) {
    archiveList.innerHTML =
      '<p style="color: rgba(238,247,247,0.72);">No archived complaints yet.</p>';
    return;
  }

  archiveList.innerHTML = archived
    .map(
      (complaint) => `
        <div class="archive-card">
          <div>
            <strong>${escapeHtml(formatComplaintNumber(complaint.id))} - ${escapeHtml(complaint.title)}</strong>
            <span>${escapeHtml(complaint.category)} - ${escapeHtml(complaint.status)} - ${escapeHtml(complaint.name)}</span>
          </div>
          <div class="archive-actions">
            <button type="button" data-restore-complaint="${complaint.id}">Restore</button>
            <button type="button" data-delete-complaint="${complaint.id}">Delete Permanently</button>
          </div>
        </div>
      `,
    )
    .join("");

  archiveList.querySelectorAll("[data-restore-complaint]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreArchivedComplaint(button.dataset.restoreComplaint);
    });
  });
  archiveList.querySelectorAll("[data-delete-complaint]").forEach((button) => {
    button.addEventListener("click", () => {
      permanentlyDeleteArchivedComplaint(button.dataset.deleteComplaint);
    });
  });
}

function openHearingNotice() {
  if (!_currentComplaintId || !_lastFocusedButton) {
    alert("Please select a complaint before generating a hearing notice.");
    return;
  }

  const d = _lastFocusedButton.dataset;
  const sourceSelect = document.getElementById("complaintSourceSelect");
  const source = sourceSelect ? sourceSelect.value : d.source || "";

  const noticeData = {
    id: formatComplaintNumber(d.id || ""),
    name: d.name || "",
    category: d.category || "",
    title: d.title || "",
    source,
    details: d.details || "",
    respondentEmail: d.respondent_email || d.respondentEmail || "",
  };

  sessionStorage.setItem(
    "selectedComplaintForNotice",
    JSON.stringify(noticeData),
  );
  window.location.href = "adminComplaintNotice.html";
}

function initCharacterCounter() {
  const textarea = document.getElementById("adminResponse");
  const hint = document.getElementById("responseHint");
  if (!textarea || !hint) return;

  textarea.setAttribute("maxlength", String(adminResponseMaxLength));
  updateCharCounter(textarea);
  textarea.addEventListener("input", () => updateCharCounter(textarea));
}

function updateCharCounter(textarea) {
  const hint = document.getElementById("responseHint");
  if (!hint) return;

  const max =
    parseInt(textarea.getAttribute("maxlength"), 10) || adminResponseMaxLength;
  const used = textarea.value.length;
  const remaining = max - used;
  const isWarning = remaining <= 150;

  hint.textContent = `${used} / ${max} characters used`;
  hint.style.color = isWarning
    ? "rgba(255, 180, 50, 0.85)"
    : "rgba(255, 255, 255, 0.4)";
}

function formatComplaintNumber(value) {
  const raw = String(value || "").trim();
  if (/^CMP-\d{4}-\d{4}$/.test(raw)) {
    return raw;
  }

  const yearSequence = raw.match(/(?:#C-)?(?:CMP-)?(\d{4})[-\s]?(\d+)/);
  if (yearSequence) {
    return `CMP-${yearSequence[1]}-${yearSequence[2].padStart(4, "0").slice(-4)}`;
  }

  const sequenceOnly = raw.match(/^(\d+)$/);
  if (sequenceOnly) {
    return `CMP-2026-${sequenceOnly[1].padStart(4, "0").slice(-4)}`;
  }

  return raw;
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value && value.trim() !== "" ? value : "—";
}