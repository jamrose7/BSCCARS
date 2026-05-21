"use strict";

let _lastFocusedButton = null;
let _currentComplaintId = null;
document.addEventListener("DOMContentLoaded", () => {
  initSignOut();
  initModalBackdrop();
  initEscapeKey();
  initCharacterCounter();
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
  _currentComplaintId = d.id || null;

  setTextById("modalTitle", "Complaint #" + (d.id || "—") + " (Admin View)");

  setTextById("complainantName", d.name);
  setTextById("complaintCategory", d.category);
  const sourceSelect = document.getElementById("complaintSourceSelect");
  if (sourceSelect) {
    sourceSelect.value = d.source || "Digital Submission";
  }
  setTextById("complaintPriority", d.priority);
  setTextById("complaintConfidential", d.confidential);
  setTextById("complaintTitle", d.title);
  setTextById("complaintDetails", d.details);

  const statusSelect = document.getElementById("statusSelect");
  if (statusSelect) {
    statusSelect.value = d.status || "pending";
  }

  toggleConfirmationBanner(false);

  const textarea = document.getElementById("adminResponse");
  if (textarea) {
    textarea.value = "";
    updateCharCounter(textarea);
  }

  buildEvidence(d.image, d.video);

  buildNotes(d.note);

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
  fileLabel.textContent = filename;

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
  alert(`Opening image: ${filename}\nImage viewer feature coming soon.`);
}

function playVideo(filename) {
  alert(`Playing video: ${filename}\nVideo player feature coming soon.`);
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

  const idLabel = _currentComplaintId
    ? `Complaint #${_currentComplaintId}`
    : "This complaint";

  const statusDisplay = {
    pending: "Pending",
    "in-progress": "In Progress",
    resolved: "Resolved",
  };

  const sourceSelect = document.getElementById("complaintSourceSelect");
  const updatedSource = sourceSelect ? sourceSelect.value : "Unknown";

  alert(
    `Action saved!\n\n` +
      `${idLabel}\n` +
      `New Status: ${statusDisplay[status] || status}\n` +
      `Source: ${updatedSource}\n` +
      `Response: ${adminResponse}`,
  );

  closeComplaintModal();
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
    id: d.id || "",
    name: d.name || "",
    category: d.category || "",
    title: d.title || "",
    source,
    details: d.details || "",
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

  textarea.addEventListener("input", () => updateCharCounter(textarea));
}

function updateCharCounter(textarea) {
  const hint = document.getElementById("responseHint");
  if (!hint) return;

  const max = parseInt(textarea.getAttribute("maxlength"), 10) || 1000;
  const remaining = max - textarea.value.length;
  const isWarning = remaining <= 100;

  hint.textContent = `${remaining} character${remaining !== 1 ? "s" : ""} remaining.`;
  hint.style.color = isWarning
    ? "rgba(255, 180, 50, 0.85)"
    : "rgba(255, 255, 255, 0.4)";
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value && value.trim() !== "" ? value : "—";
}
