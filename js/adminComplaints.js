"use strict";

let _lastFocusedButton = null;
let _currentComplaintId = null;

const archivedComplaintsKey = "bsccarsArchivedComplaints";
const adminResponseMaxLength = 1500;

let liveComplaints = [];
let activeStatusFilter = "";
let activePriorityFilter = "";

document.addEventListener("DOMContentLoaded", () => {
  restrictAssistantAdminActions();
  initModal();
  initComplaintFilters();
  initCharacterCounter();
  initStatFilters();
  initRespondentEditor();
  loadLiveComplaints();
  renderArchivedComplaints();
});

function restrictAssistantAdminActions() {
  try {
    const user = JSON.parse(localStorage.getItem("user")) || {};
    if (user.role !== "assistant_admin") return;

    document
      .querySelectorAll('button[onclick="archiveCurrentComplaint()"]')
      .forEach(button => button.remove());
  } catch {}
}

function initModal() {
  const modal = document.getElementById("complaintModal");
  if (!modal) return;

  modal.addEventListener("click", e => {
    if (e.target === modal) closeComplaintModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeComplaintModal();
    }
  });
}

function viewComplaint(button) {
  if (!button) return;

  const modal = document.getElementById("complaintModal");
  if (!modal) return;

  _lastFocusedButton = button;
  _currentComplaintId = formatComplaintNumber(button.dataset.id || "");

  const d = button.dataset;
  const complaint = liveComplaints.find(
    item => formatComplaintNumber(item.id) === _currentComplaintId
  ) || {};

  populateComplaintModal(d, complaint);

  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  loadComplaintComments(_currentComplaintId);
  loadProceedingsTimeline(_currentComplaintId);

  const title = document.getElementById("modalTitle");
  if (title) {
    title.tabIndex = -1;
    title.focus();
  }
}

function populateComplaintModal(d, complaint) {
  setTextById("modalTitle", `${_currentComplaintId || "—"} (Admin View)`);
  setTextById("complainantName", d.name);
  setTextById("complaintCategory", d.category);
  setTextById("complaintPriority", d.priority);
  setTextById("complaintConfidential", d.confidential);
  setTextById("complaintTitle", d.title);
  setTextById("complaintPurok", d.purok || "Not specified");
  setTextById("complaintIncidentDate", formatIncidentDate(d.date));
  setTextById("complaintIncidentTime", d.time || "Not specified");
  setTextById("complaintDetails", d.details);

  renderRespondentDetails(d);

  const status = normalizeStatus(d.status) || "pending";
  const statusSelect = document.getElementById("statusSelect");

  if (statusSelect) statusSelect.value = status;

  setInternalNotesEditorVisible(status !== "resolved");
  toggleConfirmationBanner(false);

  const response = document.getElementById("adminResponse");
  if (response) {
    response.value =
      complaint.adminResponse ||
      d.adminResponse ||
      "";
    updateCharCounter(response);
  }

  const sourceSelect = document.getElementById("complaintSourceSelect");

  if (sourceSelect) {
    const source = splitOtherDisplayValue(
      d.source || "Digital Submission"
    );

    sourceSelect.value = source.base || "Digital Submission";
    setSourceOtherControls(
      sourceSelect.value === "Other",
      source.specify
    );
  }

  const category = splitOtherDisplayValue(d.category || "").base;
  const isMoneyDebt = category === "Money Debt";

  [
    "createHearingNoticeBtn",
    "hearingNoticeBtn",
    "respondentInfoItem",
    "timelineSection",
    "modalWorkflowSummary",
    "proceedingsTimelineSection"
  ].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = isMoneyDebt ? "" : "none";
    }
  });

  buildEvidence(d.image, d.video);
  buildResidentFollowUps(complaint.followUps || []);

  buildNotes(
    complaint.internalNotes ??
    complaint.internal_notes ??
    d.internalNotes ??
    d.note ??
    ""
  );
}

function closeComplaintModal() {
  const modal = document.getElementById("complaintModal");
  if (!modal) return;

  modal.classList.remove("show");
  document.body.style.overflow = "";

  _lastFocusedButton?.focus();
  _lastFocusedButton = null;
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
      specify: raw.slice(raw.indexOf(":") + 1).trim()
    };
  }

  return { base: raw, specify: "" };
}

function formatOtherDisplayValue(base, specify) {
  return base === "Other" && specify
    ? `Other: ${specify}`
    : base;
}

function initComplaintFilters() {
  const category = document.getElementById("adminCategoryFilter");
  const status = document.getElementById("adminStatusFilter");
  const reset = document.getElementById("resetAdminFiltersBtn");
  const source = document.getElementById("complaintSourceSelect");

  category?.addEventListener("change", filterComplaintRows);

  status?.addEventListener("change", () => {
    activeStatusFilter = status.value;
    activePriorityFilter = "";
    filterComplaintRows();
  });

  reset?.addEventListener("click", () => {
    if (category) category.value = "";
    if (status) status.value = "";

    activeStatusFilter = "";
    activePriorityFilter = "";
    filterComplaintRows();
  });

  source?.addEventListener("change", () => {
    setSourceOtherControls(source.value === "Other");
  });
}

function filterComplaintRows() {
  const categoryFilter = document.getElementById("adminCategoryFilter");
  const statusFilter = document.getElementById("adminStatusFilter");
  const tbody = document.getElementById("complaintsBody");
  const empty = document.getElementById("emptyStateRow");

  if (!categoryFilter || !tbody) return;

  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter?.value || activeStatusFilter;

  let visible = 0;

  tbody.querySelectorAll("tr").forEach(row => {
    if (row.id === "emptyStateRow") return;

    const button = row.querySelector("button[data-category]");
    const category =
      button?.dataset.category ||
      row.cells[4]?.textContent ||
      "";

    const status = normalizeStatus(button?.dataset.status || "");
    const priority = button?.dataset.priority || "";

    const show =
      categoryMatchesFilter(category, selectedCategory) &&
      (!selectedStatus || status === selectedStatus) &&
      (!activePriorityFilter ||
        priority.toLowerCase() === activePriorityFilter.toLowerCase());

    row.style.display = show ? "" : "none";
    if (show) visible++;
  });

  if (empty) {
    empty.style.display = visible ? "none" : "table-row";
  }
}

function initStatFilters() {
  const params = new URLSearchParams(window.location.search);
  activeStatusFilter = normalizeStatus(params.get("status") || "");
  activePriorityFilter = params.get("priority") || "";

  const status = document.getElementById("adminStatusFilter");
  if (status && activeStatusFilter) {
    status.value = activeStatusFilter;
  }

  document.querySelectorAll(".complaint-stat-filter").forEach(button => {
    button.addEventListener("click", () => {
      activeStatusFilter = normalizeStatus(
        button.dataset.filterStatus || ""
      );
      activePriorityFilter =
        button.dataset.filterPriority || "";

      if (status) status.value = activeStatusFilter;
      filterComplaintRows();
    });
  });
}

function normalizeStatus(status) {
  const key = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  if (["resolved", "closed", "completed"].includes(key)) {
    return "resolved";
  }

  if (["in-progress", "progress", "ongoing"].includes(key)) {
    return "in-progress";
  }

  return key ? "pending" : "";
}

function statusLabel(status) {
  return {
    pending: "Pending",
    "in-progress": "In Progress",
    resolved: "Resolved"
  }[normalizeStatus(status)] || "Pending";
}

function statusClassForRow(status) {
  return {
    pending: "status-pending",
    "in-progress": "status-progress",
    resolved: "status-resolved"
  }[normalizeStatus(status)] || "status-pending";
}

function setStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function loadLiveComplaints() {
  if (typeof api === "undefined" || !api.getComplaints) {
    renderStatsFromRows();
    filterComplaintRows();
    return;
  }

  try {
    const response = await api.getComplaints();
    liveComplaints = Array.isArray(response?.data)
      ? response.data
      : [];

    renderComplaintTable(liveComplaints);
    renderComplaintStats(liveComplaints);
    filterComplaintRows();
  } catch (error) {
    console.warn("Unable to load live complaints.", error);
    renderStatsFromRows();
    filterComplaintRows();
  }
}

function renderComplaintStats(complaints) {
  setStat("complaintsTotal", complaints.length);

  setStat(
    "complaintsPending",
    complaints.filter(c =>
      normalizeStatus(c.status) === "pending"
    ).length
  );

  setStat(
    "complaintsProgress",
    complaints.filter(c =>
      normalizeStatus(c.status) === "in-progress"
    ).length
  );

  setStat(
    "complaintsResolved",
    complaints.filter(c =>
      normalizeStatus(c.status) === "resolved"
    ).length
  );

  setStat(
    "complaintsHighPriority",
    complaints.filter(c =>
      String(c.priority || "").toLowerCase() === "high"
    ).length
  );
}

function renderStatsFromRows() {
  const complaints = Array.from(
    document.querySelectorAll("#complaintsBody tr")
  )
    .filter(row => row.id !== "emptyStateRow")
    .map(row => row.querySelector("button[data-id]")?.dataset)
    .filter(Boolean);

  renderComplaintStats(complaints);
}

function renderComplaintTable(complaints) {
  const tbody = document.getElementById("complaintsBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  complaints.forEach(complaint => {
    tbody.appendChild(
      createComplaintRow(normalizeComplaintForTable(complaint))
    );
  });

  const empty = document.createElement("tr");
  empty.id = "emptyStateRow";
  empty.style.display = complaints.length ? "none" : "table-row";
  empty.innerHTML = `
    <td colspan="10" style="text-align:center;padding:32px;color:rgba(255,255,255,.45);font-style:italic;">
      No complaints found.
    </td>
  `;

  tbody.appendChild(empty);
}

function normalizeComplaintForTable(complaint) {
  const complainant = complaint.complainant || {};
  const attachments = Array.isArray(complaint.attachments)
    ? complaint.attachments
    : [];

  const image = attachments.find(
    item => attachmentType(item) === "image"
  );

  const video = attachments.find(
    item => attachmentType(item) === "video"
  );

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
    purok: complaint.purok || "",
    source: complaint.source || "Digital Submission",
    priority: complaint.priority || "Normal",
    status: normalizeStatus(complaint.status) || "pending",
    title: complaint.title || "Untitled complaint",
    details: complaint.details || "",
    date: complaint.incidentDate || complaint.date || "",
    time: complaint.incidentTime || complaint.time || "",

    respondent_name:
      complaint.respondent_name ||
      complaint.respondentName ||
      "",

    respondent_contact_number:
      complaint.respondent_contact_number ||
      complaint.respondentContactNumber ||
      "",

    respondent_purok:
      complaint.respondent_purok ||
      complaint.respondentPurok ||
      "",

    confidential: complaint.confidential || "No",
    image: attachmentLocation(image),
    video: attachmentLocation(video),

    adminResponse:
      complaint.adminResponse ||
      complaint.admin_response ||
      complaint.response ||
      "",

    internalNotes:
      complaint.internalNotes ||
      complaint.internal_notes ||
      "",

    note:
      complaint.adminNotes ||
      complaint.admin_notes ||
      "",

    respondent_email:
      complaint.respondent_email ||
      complaint.respondentEmail ||
      ""
  };
}

function attachmentType(attachment) {
  if (attachment?.type) {
    return String(attachment.type).toLowerCase();
  }

  const filename =
    typeof attachment === "string"
      ? attachment
      : attachment?.originalName ||
        attachment?.name ||
        "";

  if (/\.(jpe?g|png|gif|webp)$/i.test(filename)) {
    return "image";
  }

  if (/\.(mp4|webm|mov)$/i.test(filename)) {
    return "video";
  }

  return "";
}

function attachmentLocation(attachment) {
  if (typeof attachment === "string") return attachment;

  return (
    attachment?.path ||
    attachment?.url ||
    attachment?.originalName ||
    attachment?.name ||
    ""
  );
}

function formatIncidentDate(value) {
  const raw = String(value || "").trim();
  return raw || "Not specified";
}

function setSourceOtherControls(isOther, specify = "") {
  const group = document.getElementById(
    "complaintSourceOtherGroup"
  );
  const input = document.getElementById(
    "complaintSourceOtherText"
  );

  if (group) group.style.display = isOther ? "block" : "none";

  if (input) {
    input.disabled = !isOther;
    input.required = isOther;
    input.value = isOther ? specify : "";
  }
}

function getRespondentFields(data = {}) {
  return {
    respondent_name:
      data.respondent_name ||
      data.respondentName ||
      "",

    respondent_contact_number:
      data.respondent_contact_number ||
      data.respondentContactNumber ||
      "",

    respondent_purok:
      data.respondent_purok ||
      data.respondentPurok ||
      ""
  };
}

function respondentSummaryText(fields) {
  return [
    fields.respondent_name,
    fields.respondent_contact_number,
    fields.respondent_purok
  ]
    .filter(Boolean)
    .join(" | ") || "No respondent details yet.";
}

function setRespondentEditVisible(visible) {
  const group = document.getElementById("respondentEditGroup");
  const button = document.getElementById("editRespondentBtn");

  if (group) group.style.display = visible ? "grid" : "none";
  if (button) button.style.display = visible ? "none" : "inline-flex";
}

function populateRespondentInputs(fields) {
  const values = {
    respondentNameInput: fields.respondent_name,
    respondentContactInput: fields.respondent_contact_number,
    respondentPurokInput: fields.respondent_purok
  };

  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value || "";
  });
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
      ? "Correct respondent details"
      : "Add respondent details";
    editButton.disabled = false;
  }

  populateRespondentInputs(fields);
  setRespondentEditVisible(false);
}

function initRespondentEditor() {
  document
    .getElementById("editRespondentBtn")
    ?.addEventListener("click", () => {
      setRespondentEditVisible(true);
    });

  document
    .getElementById("saveRespondentBtn")
    ?.addEventListener("click", saveRespondentDetails);

  document
    .getElementById("cancelRespondentBtn")
    ?.addEventListener("click", () => {
      if (_lastFocusedButton) {
        renderRespondentDetails(_lastFocusedButton.dataset);
      } else {
        setRespondentEditVisible(false);
      }
    });
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

    respondent_purok:
      document.getElementById("respondentPurokInput")?.value.trim() || ""
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
        fields
      );

      Object.assign(
        fields,
        getRespondentFields(response?.data || fields)
      );
    } catch (error) {
      alert(error.message || "Unable to save respondent details.");
      return;
    }
  }

  Object.entries(fields).forEach(([key, value]) => {
    _lastFocusedButton.dataset[key] = value;
  });

  const complaint = liveComplaints.find(
    item =>
      formatComplaintNumber(item.id) === _currentComplaintId
  );

  if (complaint) Object.assign(complaint, fields);

  renderRespondentDetails(fields);
}

function getInternalNotesEditor() {
  return (
    document.getElementById("internalNotesEditor") ||
    document.getElementById("internalNoteEditor") ||
    document.getElementById("internal-notes-editor")
  );
}

function setInternalNotesEditorVisible(visible) {
  const editor = getInternalNotesEditor();
  const notesList = document.getElementById("internalNotesList");

  if (editor) {
    editor.hidden = !visible;
    editor.setAttribute("aria-hidden", String(!visible));
    editor.style.display = visible ? "" : "none";

    editor.querySelectorAll("input, textarea, select, button")
      .forEach(element => {
        element.disabled = !visible;
        element.tabIndex = visible ? 0 : -1;
      });
  }

  [
    "newNoteInput",
    "assignmentRoleSelect",
    "assignmentNameInput",
    "assignmentTaskInput",
    "addInternalNoteBtn",
    "addNoteBtn"
  ].forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;

    element.disabled = !visible;

    if (!visible) {
      element.tabIndex = -1;
      element.style.display = "none";
    } else {
      element.tabIndex = 0;
      element.style.display = "";
    }
  });

  if (notesList) {
    notesList.hidden = false;
    notesList.style.display = "";
    notesList.removeAttribute("aria-hidden");
  }
}

function buildNotes(notes) {
  const list = document.getElementById("internalNotesList");
  if (!list) return;

  list.innerHTML = "";

  if (!notes) return;

  if (Array.isArray(notes)) {
    notes.forEach(note => {
      if (!note) return;

      if (typeof note === "object") {
        list.appendChild(createStructuredNoteElement(note));
      } else if (String(note).trim()) {
        list.appendChild(createNoteElement(String(note).trim()));
      }
    });
    return;
  }

  if (typeof notes === "object") {
    list.appendChild(createStructuredNoteElement(notes));
    return;
  }

  const text = String(notes).trim();

  if (text && text !== "[object Object]") {
    list.appendChild(createNoteElement(text));
  }
}

function createStructuredNoteElement(data = {}) {
  const div = document.createElement("div");
  div.className = "internal-note";

  const content = document.createElement("div");
  content.className = "internal-note-content";

  const fields = [
    ["Assigned Role", data.role],
    [
      "Assigned Personnel",
      data.assignedPersonnel || data.assigned_personnel
    ],
    ["Field Task", data.fieldTask || data.field_task],
    ["Note", data.note || data.comment || data.text]
  ];

  fields.forEach(([label, value]) => {
    value = String(value || "").trim();
    if (!value) return;

    const row = document.createElement("div");
    row.className = "internal-note-row";
    row.innerHTML =
      `<strong>${label}:</strong> ${escapeHtml(value)}`;
    content.appendChild(row);
  });

  if (!content.children.length) {
    content.textContent = "No internal note details available.";
  }

  div.appendChild(content);
  return div;
}

function createNoteElement(text) {
  const div = document.createElement("div");
  div.className = "internal-note";
  div.textContent = text;
  return div;
}

async function loadComplaintComments(complaintId) {
  const list = document.getElementById("internalNotesList");

  if (
    !list ||
    typeof api === "undefined" ||
    !api.getComplaintComments
  ) {
    return;
  }

  try {
    const response = await api.getComplaintComments(complaintId);
    const comments = Array.isArray(response?.data)
      ? response.data
      : [];

    const notes = comments.filter(comment =>
      Boolean(comment.isInternal)
    );

    if (!notes.length) return;

    list.innerHTML = "";

    notes.forEach(comment => {
      const structured =
        comment.role ||
        comment.assignedPersonnel ||
        comment.assigned_personnel ||
        comment.fieldTask ||
        comment.field_task;

      if (structured) {
        list.appendChild(
          createStructuredNoteElement(comment)
        );
      } else {
        const text =
          comment.comment ||
          comment.text ||
          "";

        if (String(text).trim()) {
          list.appendChild(createNoteElement(text));
        }
      }
    });
  } catch (error) {
    console.warn("Unable to load complaint comments.", error);
  }
}

function buildAssignmentSummary() {
  const role =
    document.getElementById("assignmentRoleSelect")
      ?.value.trim() || "";

  const name =
    document.getElementById("assignmentNameInput")
      ?.value.trim() || "";

  const task =
    document.getElementById("assignmentTaskInput")
      ?.value.trim() || "";

  return [
    role && `Assigned role: ${role}`,
    name && `Assigned personnel: ${name}`,
    task && `Field task: ${task}`
  ]
    .filter(Boolean)
    .join(" | ");
}

function composeInternalNoteText(text) {
  const note = String(text || "").trim();
  const assignment = buildAssignmentSummary();

  if (!assignment && !note) return "";
  if (!note) return assignment;

  return assignment
    ? `${assignment} — ${note}`
    : note;
}

async function addInternalNote() {
  if (normalizeStatus(getCurrentComplaintStatus()) === "resolved") {
    setInternalNotesEditorVisible(false);
    return;
  }

  const input = document.getElementById("newNoteInput");
  const list = document.getElementById("internalNotesList");

  if (!input || !list) return;

  const finalText = composeInternalNoteText(input.value);

  if (!finalText) {
    input.focus();
    return;
  }

  try {
    let savedText = finalText;

    if (
      typeof api !== "undefined" &&
      api.addComplaintComment &&
      _currentComplaintId
    ) {
      const response = await api.addComplaintComment(
        _currentComplaintId,
        finalText,
        true
      );

      savedText =
        response?.data?.comment ||
        finalText;
    }

    const note = createNoteElement(savedText);
    note.style.marginTop = "8px";
    list.appendChild(note);

    [
      "newNoteInput",
      "assignmentRoleSelect",
      "assignmentNameInput",
      "assignmentTaskInput"
    ].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });

    input.focus();
  } catch (error) {
    alert(error.message || "Unable to save internal note.");
  }
}

function getCurrentComplaintStatus() {
  return (
    document.getElementById("statusSelect")?.value ||
    _lastFocusedButton?.dataset.status ||
    "pending"
  );
}

/* Evidence */

function buildEvidence(image, video) {
  const container = document.getElementById("evidenceContainer");
  if (!container) return;

  container.innerHTML = "";

  const files = [
    image && [image, "image"],
    video && [video, "video"]
  ].filter(Boolean);

  if (!files.length) {
    const message = document.createElement("p");
    message.className = "timeline-empty";
    message.textContent = "No attachments uploaded.";
    container.appendChild(message);
    return;
  }

  files.forEach(([filename, type]) => {
    container.appendChild(
      createEvidenceCard(String(filename).trim(), type)
    );
  });
}

/**
 * Opens an attachment served from a protected (authenticateToken-guarded)
 * backend route in a new tab. A plain window.open()/anchor navigation to
 * a protected URL cannot carry the Authorization header, so the server
 * would correctly reject it with 401. Instead we fetch the file with the
 * bearer token attached, turn the response into a blob, and open that
 * blob URL — mirroring the same pattern already used by loadProtectedMedia
 * in ui.js for the resident-facing attachment viewer.
 */
async function openProtectedAttachment(url, triggerButton) {
  const originalText = triggerButton ? triggerButton.textContent : "";

  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = "Loading…";
  }

  try {
    const token = typeof api !== "undefined" && api.getToken ? api.getToken() : null;

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Your session may have expired. Please sign in again."
          : "Unable to load this attachment."
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    window.open(objectUrl, "_blank", "noopener");

    // Release the blob URL once the new tab has had a chance to load it.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (error) {
    alert(error.message || "Unable to open this attachment. Please try again.");
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalText;
    }
  }
}

function createEvidenceCard(filename, type) {
  const image = type === "image";
  const card = document.createElement("div");
  card.className = "evidence-item";
  card.dataset.filename = filename;

  const fileLabel = document.createElement("div");
  fileLabel.className = "evidence-file";
  fileLabel.textContent = displayFileName(filename);

  const actions = document.createElement("div");
  actions.className = "evidence-actions";

  const view = document.createElement("button");
  view.type = "button";
  view.className = "btn-evidence";
  view.textContent = image ? "View Image" : "Play Video";
  view.addEventListener("click", () =>
    openProtectedAttachment(filename, view)
  );

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn-evidence btn-danger";
  remove.textContent = image ? "Remove Image" : "Remove Video";
  remove.addEventListener("click", () =>
    removeEvidence(filename, card)
  );

  actions.append(view, remove);
  card.append(fileLabel, actions);

  return card;
}

function displayFileName(path) {
  return String(path || "").split(/[\\/]/).pop() || path;
}

function removeEvidence(filename, card) {
  if (!confirm(`Are you sure you want to remove "${filename}"?`)) {
    return;
  }

  card?.remove();

  const container = document.getElementById("evidenceContainer");

  if (container && !container.children.length) {
    const message = document.createElement("p");
    message.className = "timeline-empty";
    message.textContent = "No attachments uploaded.";
    container.appendChild(message);
  }
}

function buildResidentFollowUps(followUps) {
  const container = document.getElementById("residentFollowUpsList");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(followUps) || !followUps.length) {
    container.innerHTML =
      '<p class="timeline-empty">No resident follow-ups yet.</p>';
    return;
  }

  followUps.forEach(item => {
    const entry = document.createElement("div");
    entry.className = "resident-follow-up-entry";

    const date = document.createElement("div");
    date.className = "resident-follow-up-meta";
    date.textContent = new Date(
      item.createdAt || Date.now()
    ).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

    const text = document.createElement("div");
    text.className = "resident-follow-up-text";
    text.textContent =
      item.message ||
      item.update ||
      item.text ||
      "";

    entry.append(date, text);
    container.appendChild(entry);
  });
}

function onStatusChange() {
  const status = normalizeStatus(getCurrentComplaintStatus());

  setInternalNotesEditorVisible(status !== "resolved");
  toggleConfirmationBanner(true);
}

function toggleConfirmationBanner(visible) {
  const banner = document.getElementById("confirmationBanner");
  if (banner) {
    banner.style.display = visible ? "flex" : "none";
  }
}

function setUnderReviewBadge() {
  const badge = document.getElementById("underReviewBadge");
  if (badge) badge.style.display = "none";
}

async function saveAction() {
  const textarea = document.getElementById("adminResponse");
  const statusSelect = document.getElementById("statusSelect");

  if (!textarea || !statusSelect) return;

  const adminResponse = textarea.value.trim();
  const status = normalizeStatus(statusSelect.value);

  if (!adminResponse) {
    alert("Please enter an official response before saving.");
    textarea.focus();
    return;
  }

  if (adminResponse.length > adminResponseMaxLength) {
    alert(
      `Admin response must not exceed ${adminResponseMaxLength} characters.`
    );
    textarea.focus();
    return;
  }

  const sourceSelect = document.getElementById(
    "complaintSourceSelect"
  );

  const sourceOtherText = document.getElementById(
    "complaintSourceOtherText"
  );

  const sourceBase = sourceSelect?.value || "Unknown";
  const sourceSpecify =
    sourceOtherText?.value.trim() || "";

  if (sourceBase === "Other" && !sourceSpecify) {
    alert("Please specify the Other intake source.");
    sourceOtherText?.focus();
    return;
  }

  const updatedSource = formatOtherDisplayValue(
    sourceBase,
    sourceSpecify
  );

  try {
    if (
      typeof api !== "undefined" &&
      api.updateComplaintStatus &&
      _currentComplaintId
    ) {
      await api.updateComplaintStatus(
        _currentComplaintId,
        status,
        adminResponse,
        {
          source: sourceBase,
          sourceSpecify
        }
      );
    }

    if (_lastFocusedButton) {
      _lastFocusedButton.dataset.status = status;
      _lastFocusedButton.dataset.source = updatedSource;
      _lastFocusedButton.dataset.adminResponse = adminResponse;

      const row = _lastFocusedButton.closest("tr");
      const pill = row?.querySelector("[data-status-pill]");

      if (pill) {
        pill.className = statusClassForRow(status);
        pill.textContent = statusLabel(status);
      }

      const complaint = liveComplaints.find(
        item =>
          formatComplaintNumber(item.id) ===
          _currentComplaintId
      );

      if (complaint) {
        complaint.status = status;
        complaint.source = updatedSource;
        complaint.adminResponse = adminResponse;
      }

      if (row?.cells[5]) {
        row.cells[5].textContent = updatedSource;
      }

      renderComplaintStats(
        liveComplaints.length
          ? liveComplaints
          : getActiveComplaintsFromRows()
      );

      filterComplaintRows();
    }

    setInternalNotesEditorVisible(status !== "resolved");

    alert(
      `Action saved!\n\n${_currentComplaintId || "This complaint"}\n` +
      `New Status: ${statusLabel(status)}\n` +
      `Source: ${updatedSource}\n` +
      `Response: ${adminResponse}`
    );

    closeComplaintModal();
  } catch (error) {
    alert(error.message || "Unable to save admin response.");
  }
}

function initCharacterCounter() {
  const textarea = document.getElementById("adminResponse");
  if (!textarea) return;

  textarea.maxLength = adminResponseMaxLength;
  updateCharCounter(textarea);

  textarea.addEventListener("input", () =>
    updateCharCounter(textarea)
  );
}

function updateCharCounter(textarea) {
  const hint = document.getElementById("responseHint");
  if (!hint) return;

  const max =
    Number(textarea.maxLength) ||
    adminResponseMaxLength;

  const used = textarea.value.length;

  hint.textContent = `${used} / ${max} characters used`;
  hint.style.color =
    max - used <= 150
      ? "rgba(255,180,50,.85)"
      : "rgba(255,255,255,.4)";
}

function stageLabel(stage) {
  return {
    first_mediation: "First Mediation",
    second_mediation: "Second Mediation",
    conciliation: "Conciliation",
    cfa_issued: "CFA Issued"
  }[String(stage || "").trim()] || "First Mediation";
}

function outcomeLabel(outcome) {
  return {
    pending: "Pending",
    respondent_appeared: "Respondent Appeared",
    respondent_absent: "Respondent Absent",
    settled: "Settled",
    escalated: "Escalated",
    unresolved: "Unresolved"
  }[String(outcome || "pending").trim().toLowerCase()] ||
  "Pending";
}

function outcomeBadgeClass(outcome) {
  return {
    pending: "timeline-badge pending",
    respondent_appeared: "timeline-badge appeared",
    respondent_absent: "timeline-badge absent",
    settled: "timeline-badge settled",
    escalated: "timeline-badge escalated",
    unresolved: "timeline-badge pending"
  }[String(outcome || "pending").trim().toLowerCase()] ||
  "timeline-badge pending";
}

function formatTimelineDate(value) {
  if (!value) return "Not set";

  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getProceedingsSummary(notices) {
  if (!Array.isArray(notices) || !notices.length) {
    return "No hearing activity yet.";
  }

  const latest = notices[notices.length - 1];

  const served = latest.notice_served_method
    ? `Served via ${String(
        latest.notice_served_method
      ).replace(/_/g, " ")}`
    : "Service pending";

  return `${stageLabel(latest.stage)} · ${outcomeLabel(
    latest.outcome
  )} · ${served}`;
}

function renderProceedingsTimeline(notices) {
  const list = document.getElementById("timelineList");
  const empty = document.getElementById("timelineEmpty");

  if (!list) return;

  list.innerHTML = "";

  if (!Array.isArray(notices) || !notices.length) {
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";

  notices.forEach(notice => {
    const item = document.createElement("div");
    item.className = "timeline-item";

    const date = formatTimelineDate(
      notice.hearing_date ||
      notice.hearingDate ||
      notice.created_at ||
      notice.createdAt
    );

    const served = notice.notice_served_method
      ? `Served via ${String(
          notice.notice_served_method
        ).replace(/_/g, " ")}`
      : "Service pending";

    item.innerHTML = `
      <div class="timeline-item-main">
        <div class="timeline-stage">
          ${escapeHtml(stageLabel(notice.stage))}
        </div>
        <div class="timeline-date">
          ${escapeHtml(date)}
        </div>
        <div class="timeline-served">
          ${escapeHtml(served)}
        </div>
      </div>
      <div class="${outcomeBadgeClass(notice.outcome)}">
        ${escapeHtml(outcomeLabel(notice.outcome))}
      </div>
    `;

    list.appendChild(item);
  });
}

function renderProceedingsSummary(notices) {
  const text = getProceedingsSummary(notices);

  setTextById("timelineSummaryText", text);
  setTextById("modalWorkflowSummaryText", text);
}

function updateProceedingsActions(notices) {
  const next = document.getElementById(
    "timelineNextActionBtn"
  );

  const cfa = document.getElementById("issueCfaButton");

  if (!next || !cfa) return;

  const latest = notices?.length
    ? notices[notices.length - 1]
    : null;

  const stage = latest?.stage || "first_mediation";
  const outcome = String(
    latest?.outcome || "pending"
  ).toLowerCase();

  if (
    outcome === "respondent_absent" &&
    ["first_mediation", "second_mediation"].includes(stage)
  ) {
    next.style.display = "inline-flex";
    next.textContent =
      stage === "first_mediation"
        ? "Create Second Mediation Notice"
        : "Create Conciliation Notice";

    next.onclick = () =>
      openProceedingsNoticeForStage(
        stage === "first_mediation"
          ? "second_mediation"
          : "conciliation"
      );
  } else {
    next.style.display = "none";
  }

  const cfaEligible = Array.isArray(notices) &&
    notices.some(notice =>
      notice.stage === "conciliation" &&
      [
        "respondent_absent",
        "escalated",
        "pending",
        "unresolved"
      ].includes(
        String(notice.outcome || "pending").toLowerCase()
      )
    );

  cfa.style.display = cfaEligible
    ? "inline-flex"
    : "none";

  cfa.onclick = issueCfaNotice;
}

async function loadProceedingsTimeline(complaintId) {
  const list = document.getElementById("timelineList");
  const empty = document.getElementById("timelineEmpty");

  if (!list) return;

  list.innerHTML = "";

  if (empty) {
    empty.style.display = "block";
    empty.textContent = "Loading proceedings…";
  }

  try {
    if (typeof api === "undefined" || !api.get) return;

    const response = await api.get(
      `/complaints/${complaintId}/hearing-notices`
    );

    const notices = Array.isArray(response?.data)
      ? response.data
      : [];

    renderProceedingsTimeline(notices);
    renderProceedingsSummary(notices);
    updateProceedingsActions(notices);
  } catch (error) {
    console.warn(
      "Unable to load proceedings timeline.",
      error
    );

    if (empty) {
      empty.style.display = "block";
      empty.textContent =
        "No proceedings have been recorded yet.";
    }
  }
}

function getNoticeData(stage) {
  if (!_currentComplaintId || !_lastFocusedButton) {
    alert(
      "Please select a complaint before creating a follow-up notice."
    );
    return null;
  }

  const d = _lastFocusedButton.dataset;

  return {
    id: formatComplaintNumber(d.id || ""),
    name: d.name || "",
    category: d.category || "",
    title: d.title || "",
    source:
      document.getElementById("complaintSourceSelect")?.value ||
      d.source ||
      "",
    details: d.details || "",
    respondent_name: d.respondent_name || "",
    confidential: d.confidential || "",
    stage
  };
}

function openProceedingsNoticeForStage(stage) {
  const noticeData = getNoticeData(stage);
  if (!noticeData) return;

  sessionStorage.setItem(
    "selectedComplaintForNotice",
    JSON.stringify(noticeData)
  );

  window.location.href = "adminComplaintNotice.html";
}

async function issueCfaNotice() {
  if (!_currentComplaintId) {
    alert("Please select a complaint before issuing a CFA.");
    return;
  }

  if (typeof api === "undefined" || !api.post) {
    alert(
      "CFA notice generation is unavailable in the current offline mode."
    );
    return;
  }

  try {
    const response = await api.post(
      "/hearing-notices",
      {
        complaint_id: _currentComplaintId,
        stage: "cfa_issued",
        outcome: "pending"
      }
    );

    const notice = response?.data || response;
    if (!notice?.id) return;

    const data = getNoticeData("cfa_issued");
    if (!data) return;

    data.noticeId = notice.id;

    sessionStorage.setItem(
      "selectedComplaintForNotice",
      JSON.stringify(data)
    );

    window.location.href = "adminComplaintNotice.html";
  } catch (error) {
    alert(error.message || "Unable to issue CFA notice.");
  }
}

function openHearingNotice() {
  if (!_currentComplaintId || !_lastFocusedButton) {
    alert(
      "Please select a complaint before generating a hearing notice."
    );
    return;
  }

  const d = _lastFocusedButton.dataset;
  const category =
    splitOtherDisplayValue(d.category || "").base;

  if (category !== "Money Debt") {
    alert(
      "Hearing notices are only available for Money Debt complaints."
    );
    return;
  }

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
    respondent_name: d.respondent_name || ""
  };

  sessionStorage.setItem(
    "selectedComplaintForNotice",
    JSON.stringify(noticeData)
  );

  window.location.href = "adminComplaintNotice.html";
}

function getArchivedComplaints() {
  try {
    return JSON.parse(
      localStorage.getItem(archivedComplaintsKey)
    ) || [];
  } catch {
    return [];
  }
}

function saveArchivedComplaints(complaints) {
  localStorage.setItem(
    archivedComplaintsKey,
    JSON.stringify(complaints)
  );
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
    purok: data.purok || "",
    date: data.date || "",
    time: data.time || "",
    confidential: data.confidential || "",
    image: data.image || "",
    video: data.video || "",
    adminResponse: data.adminResponse || "",
    internalNotes: [],
    note: data.note || ""
  };
}

async function archiveCurrentComplaint() {
  if (!_lastFocusedButton || !_currentComplaintId) {
    alert("Please select a complaint before archiving.");
    return;
  }

  const archivedComplaintId = _currentComplaintId;

  if (!confirm(
    `Archive ${archivedComplaintId}? It will be hidden from the active complaints list but kept for records.`
  )) {
    return;
  }

  if (typeof api !== "undefined" && api.archiveComplaint) {
    try {
      await api.archiveComplaint(archivedComplaintId);
    } catch (error) {
      alert(error.message || "Unable to archive complaint.");
      return;
    }
  }

  const complaint = {
    ...getComplaintDataFromButton(_lastFocusedButton),
    archivedAt: new Date().toISOString()
  };

  const archived = getArchivedComplaints().filter(
    item => item.id !== complaint.id
  );

  archived.unshift(complaint);
  saveArchivedComplaints(archived);

  _lastFocusedButton.closest("tr")?.remove();

  liveComplaints = liveComplaints.filter(
    item =>
      formatComplaintNumber(item.id) !==
      archivedComplaintId
  );

  renderComplaintStats(
    liveComplaints.length
      ? liveComplaints
      : getActiveComplaintsFromRows()
  );

  renderArchivedComplaints();
  closeComplaintModal();

  window.BSCCARSNotifications?.add?.({
    title: "Complaint archived",
    message:
      `${archivedComplaintId} was moved to the archive and can be restored later.`
  });
}

function getActiveComplaintsFromRows() {
  return Array.from(
    document.querySelectorAll("#complaintsBody tr")
  )
    .filter(row => row.id !== "emptyStateRow")
    .map(row =>
      row.querySelector("button[data-id]")?.dataset
    )
    .filter(Boolean);
}

async function restoreArchivedComplaint(id) {
  const archived = getArchivedComplaints();

  const complaint = archived.find(
    item => item.id === id
  );

  if (!complaint) return;

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
    const empty = document.getElementById("emptyStateRow");

    tbody.insertBefore(
      createComplaintRow(complaint),
      empty || null
    );
  }

  saveArchivedComplaints(
    archived.filter(item => item.id !== id)
  );

  liveComplaints.unshift(complaint);

  renderComplaintStats(liveComplaints);
  renderArchivedComplaints();
  filterComplaintRows();

  window.BSCCARSNotifications?.add?.({
    title: "Complaint restored",
    message:
      `${formatComplaintNumber(id)} was restored from the archive.`
  });
}

function renderArchivedComplaints() {
  const list = document.getElementById(
    "complaintsArchiveList"
  );

  if (!list) return;

  const archived = getArchivedComplaints();

  if (!archived.length) {
    list.innerHTML =
      '<p style="color:rgba(238,247,247,.72);">No archived complaints yet.</p>';
    return;
  }

  list.innerHTML = archived.map(complaint => `
    <div class="archive-card">
      <div>
        <strong>
          ${escapeHtml(formatComplaintNumber(complaint.id))}
          - ${escapeHtml(complaint.title)}
        </strong>
        <span>
          ${escapeHtml(complaint.category)}
          - ${escapeHtml(complaint.status)}
          - ${escapeHtml(complaint.name)}
        </span>
      </div>
      <div class="archive-actions">
        <button
          type="button"
          data-restore-complaint="${escapeHtml(complaint.id)}"
        >
          Restore
        </button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-restore-complaint]")
    .forEach(button => {
      button.addEventListener("click", () =>
        restoreArchivedComplaint(
          button.dataset.restoreComplaint
        )
      );
    });
}

function createComplaintRow(complaint) {
  const row = document.createElement("tr");

  const names = complaint.name
    .split(" ")
    .filter(Boolean);

  const firstName =
    complaint.firstName ||
    names[0] ||
    "-";

  const lastName =
    complaint.lastName ||
    names[names.length - 1] ||
    "-";

  const middleName =
    complaint.middleName ||
    (names.length > 2
      ? names.slice(1, -1).join(" ")
      : "-");

  const status =
    normalizeStatus(complaint.status) || "pending";

  const priorityClass =
    String(complaint.priority || "").toLowerCase() === "high"
      ? "priority-high"
      : "priority-normal";

  row.innerHTML = `
    <td>${escapeHtml(formatComplaintNumber(complaint.id))}</td>
    <td>${escapeHtml(firstName)}</td>
    <td>${escapeHtml(lastName)}</td>
    <td>${escapeHtml(middleName)}</td>
    <td>${escapeHtml(complaint.category)}</td>
    <td>${escapeHtml(complaint.source)}</td>
    <td>
      <span class="${priorityClass}">
        ${escapeHtml(complaint.priority)}
      </span>
    </td>
    <td>${escapeHtml(complaint.confidential)}</td>
    <td>
      <span
        data-status-pill
        class="${statusClassForRow(status)}"
      >
        ${statusLabel(status)}
      </span>
    </td>
    <td></td>
  `;

  const button = document.createElement("button");
  button.className = "btn-action";
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `View complaint ${formatComplaintNumber(complaint.id)}`
  );
  button.textContent = "View";

  Object.entries(complaint).forEach(([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      typeof value === "object"
    ) {
      return;
    }

    button.dataset[key] = String(value);
  });

  button.addEventListener("click", () =>
    viewComplaint(button)
  );

  row.lastElementChild.appendChild(button);

  return row;
}

/* Helpers */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatComplaintNumber(value) {
  const raw = String(value || "").trim();

  if (/^CMP-\d{4}-\d{4}$/.test(raw)) {
    return raw;
  }

  const yearSequence = raw.match(
    /(?:#C-)?(?:CMP-)?(\d{4})[-\s]?(\d+)/
  );

  if (yearSequence) {
    return `CMP-${yearSequence[1]}-${yearSequence[2]
      .padStart(4, "0")
      .slice(-4)}`;
  }

  if (/^\d+$/.test(raw)) {
    return `CMP-2026-${raw
      .padStart(4, "0")
      .slice(-4)}`;
  }

  return raw;
}

function setTextById(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  const text = String(value || "").trim();
  element.textContent = text || "—";
}
