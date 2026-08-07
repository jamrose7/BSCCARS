"use strict";

const sampleComplaints = [
  {
    id: "CMP-2026-0001",
    title: "Loud music past midnight",
    category: "Noise and Public Disturbance",
    priority: "Normal",
    status: "In Progress",
    date: "2026-07-11",
    time: "4:30 PM",
    purok: "Purok Sara-Sara 1",
    details: "Loud music played repeatedly past midnight.",
    confidential: "Yes (Public-hidden)",
    attachments: [],
    responses: [
      {
        date: "2026-07-11",
        time: "4:30 PM",
        text: "Complaint acknowledged. We have dispatched an officer to investigate.",
      },
    ],
    history: [
      {
        label: "Submitted",
        status: "Pending",
        date: "2026-07-11",
        time: "4:30 PM",
      },
      {
        label: "Acknowledged",
        status: "In Progress",
        date: "2026-07-11",
        time: "4:45 PM",
      },
    ],
  },
];

let _lastFocusedViewBtn = null;
let complaints = [];
let activeComplaintId = "";

function getStoredComplaints() {
  try {
    return JSON.parse(localStorage.getItem("bsccarsComplaints")) || [];
  } catch (error) {
    return [];
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  loadComplaints();
  initModalClose();
  initEscapeKey();
  initFollowUpForm();
});

function currentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.id || "";
  } catch (error) {
    return "";
  }
}

function normalizeStatus(status) {
  const key = String(status || "Pending")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (["resolved", "closed", "completed"].includes(key)) return "Resolved";
  if (["in-progress", "progress", "ongoing"].includes(key))
    return "In Progress";
  return "Pending";
}

function normalizeApiComplaint(complaint) {
  const created = new Date(
    complaint.createdAt || complaint.submittedAt || Date.now(),
  );
  const attachments = Array.isArray(complaint.attachments)
    ? complaint.attachments
        .map((item) => {
          if (typeof item === "string") return { name: item, type: "", url: "" };
          return {
            name: item.originalName || item.name || "",
            type: item.type || "",
            url: item.path || item.url || "",
          };
        })
        .filter((item) => item.name)
    : [];
  const status = normalizeStatus(complaint.status);
  const apiHistory = Array.isArray(complaint.statusHistory)
    ? complaint.statusHistory.map((item) => {
        const itemDate = new Date(item.createdAt || created);
        return {
          label: item.label || "Status updated",
          status: normalizeStatus(item.newStatus || item.status),
          notes: item.notes || "",
          date: itemDate.toISOString().slice(0, 10),
          time: itemDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        };
      })
    : [];
  return {
    id: formatComplaintNumber(complaint.id || complaint.referenceId),
    referenceId: formatComplaintNumber(complaint.referenceId || complaint.id),
    title: complaint.title || "Untitled complaint",
    category: complaint.category || "Uncategorized",
    priority: complaint.priority || "Normal",
    status,
    date: complaint.incidentDate || created.toISOString().slice(0, 10),
    time:
      complaint.incidentTime ||
      created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    purok: complaint.purok || "",
    details: complaint.details || "",
    confidential: complaint.confidential || "No",
    attachments,
    followUps: Array.isArray(complaint.followUps)
      ? complaint.followUps.map(normalizeFollowUp)
      : [],
    responses: complaint.adminResponse
      ? [
          {
            date: new Date().toISOString().slice(0, 10),
            time: "",
            text: complaint.adminResponse,
          },
        ]
      : [],
    history: apiHistory.length
      ? apiHistory
      : [
          {
            label: "Submitted",
            status: "Pending",
            date: created.toISOString().slice(0, 10),
            time: "",
          },
          ...(status !== "Pending"
            ? [
                {
                  label: "Updated",
                  status,
                  date: created.toISOString().slice(0, 10),
                  time: "",
                },
              ]
            : []),
        ],
  };
}

async function loadComplaints() {
  const localComplaints = getStoredComplaints();
  try {
    const userId = currentUserId();
    const response = await api.getComplaints(
      userId ? { submitterId: userId } : {},
    );
    const apiComplaints = Array.isArray(response?.data) ? response.data : [];
    complaints = [
      ...apiComplaints.map(normalizeApiComplaint),
      ...localComplaints,
    ].map((complaint) => ({
      ...complaint,
      status: normalizeStatus(complaint.status),
      id: formatComplaintNumber(complaint.id || complaint.referenceId),
      referenceId: formatComplaintNumber(complaint.referenceId || complaint.id),
      followUps: Array.isArray(complaint.followUps)
        ? complaint.followUps.map(normalizeFollowUp)
        : [],
    }));
  } catch (error) {
    complaints = [...localComplaints, ...sampleComplaints].map((complaint) => ({
      ...complaint,
      status: normalizeStatus(complaint.status),
      id: formatComplaintNumber(complaint.id || complaint.referenceId),
      referenceId: formatComplaintNumber(complaint.referenceId || complaint.id),
      followUps: Array.isArray(complaint.followUps)
        ? complaint.followUps.map(normalizeFollowUp)
        : [],
    }));
  }

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("complaintsBody");
  const emptyState = document.getElementById("emptyState");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (complaints.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  complaints.forEach((c) => {
    const statusClass = c.status.toLowerCase().replace(/\s+/g, "-");
    const row = document.createElement("tr");

    const cells = [c.title, c.category, c.priority];
    cells.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      row.appendChild(td);
    });

    const statusTd = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-pill ${statusClass}`;
    pill.textContent = c.status;
    statusTd.appendChild(pill);
    row.appendChild(statusTd);

    [c.date, c.time].forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      row.appendChild(td);
    });

    const viewTd = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.className = "view-btn";
    viewBtn.type = "button";
    viewBtn.setAttribute("aria-label", `View complaint: ${c.title}`);
    viewBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
    viewBtn.addEventListener("click", () => openDetailModal(c, viewBtn));
    viewTd.appendChild(viewBtn);
    row.appendChild(viewTd);

    tbody.appendChild(row);
  });
}

function openDetailModal(complaint, triggerBtn) {
  const modal = document.getElementById("complaintDetailModal");
  if (!modal) return;

  _lastFocusedViewBtn = triggerBtn || null;

  setText(
    "detailModalTitle",
    `${formatComplaintNumber(complaint.id)} - Detail View`,
  );
  setText("detailId", formatComplaintNumber(complaint.id));
  setText("detailCategory", complaint.category);
  setText("detailPurok", complaint.purok);
  setText("detailPriority", complaint.priority);
  setText("detailConfidential", complaint.confidential);
  setText("detailDate", complaint.date);
  setText("detailTime", complaint.time);
  setText("detailDetails", complaint.details);

  buildAttachments(complaint.attachments);
  buildResponses(complaint.responses);
  buildFollowUps(complaint.followUps);
  buildTimeline(complaint.history);
  configureFollowUpForm(complaint);

  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  const titleEl = document.getElementById("detailModalTitle");
  if (titleEl) {
    titleEl.setAttribute("tabindex", "-1");
    titleEl.focus();
  }
}

function normalizeFollowUp(item) {
  const created = new Date(item.createdAt || Date.now());
  return {
    id: item.id || `follow-up-${created.getTime()}`,
    text: item.message || item.update || item.text || "",
    date: created.toISOString().slice(0, 10),
    time: created.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function isActiveComplaint(complaint) {
  return ["Pending", "In Progress"].includes(normalizeStatus(complaint.status));
}

function configureFollowUpForm(complaint) {
  const form = document.getElementById("followUpForm");
  const textarea = document.getElementById("followUpText");
  const help = document.getElementById("followUpHelp");
  const submit = document.getElementById("followUpSubmit");
  if (!form || !textarea || !help || !submit) return;

  activeComplaintId = complaint.id;
  form.dataset.complaintId = complaint.id;
  textarea.value = "";
  help.textContent = isActiveComplaint(complaint)
    ? "0 / 1500"
    : "Only active complaints can receive follow-ups.";
  textarea.disabled = !isActiveComplaint(complaint);
  submit.disabled = !isActiveComplaint(complaint);
}

function closeDetailModal() {
  const modal = document.getElementById("complaintDetailModal");
  if (!modal) return;

  modal.classList.remove("show");
  document.body.style.overflow = "";

  if (_lastFocusedViewBtn) {
    _lastFocusedViewBtn.focus();
    _lastFocusedViewBtn = null;
  }
}

function initModalClose() {
  const modal = document.getElementById("complaintDetailModal");
  const backBtn = document.getElementById("detailBackBtn");

  if (backBtn) backBtn.addEventListener("click", closeDetailModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeDetailModal();
    });
  }
}

function initEscapeKey() {
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("complaintDetailModal");
    if (e.key === "Escape" && modal && modal.classList.contains("show")) {
      closeDetailModal();
    }
  });
}

function buildAttachments(attachments) {
  const container = document.getElementById("detailAttachments");
  if (!container) return;

  container.innerHTML = "";

  if (!attachments || attachments.length === 0) {
    const msg = document.createElement("p");
    msg.className = "detail-empty-msg";
    msg.textContent = "No attachments uploaded.";
    container.appendChild(msg);
    return;
  }

  attachments.forEach((attachment) => {
    const filename =
      typeof attachment === "string" ? attachment : attachment.name || "";
    const type = typeof attachment === "string" ? "" : attachment.type || "";
    const url = typeof attachment === "string" ? "" : attachment.url || "";
    const isVideo = type === "video" || /\.(mp4|mov|avi)$/i.test(filename);
    const isImage =
      type === "image" || /\.(jpe?g|png|gif|webp)$/i.test(filename);
    const preview = document.createElement("article");
    preview.className = "attachment-preview";

    if (url && (isImage || isVideo)) {
      if (isImage) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute("aria-label", `Open image: ${filename}`);
        const image = document.createElement("img");
        image.src = url;
        image.alt = filename;
        image.addEventListener("error", () => {
          link.replaceWith(createAttachmentUnavailableMessage());
        });
        link.appendChild(image);
        preview.appendChild(link);
      } else {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", filename);
        preview.appendChild(video);
      }
    }
    const tag = document.createElement("div");
    tag.className = "attachment-tag";

    const icon = document.createElement("span");
    icon.className = "attachment-tag-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = filename.match(/\.(mp4|mov|avi)$/i) ? "🎬" : "🖼️";

    const name = document.createElement("span");
    name.textContent = filename;

    tag.appendChild(icon);
    tag.appendChild(name);
    preview.appendChild(tag);
    container.appendChild(preview);
  });
}

function createAttachmentUnavailableMessage() {
  const message = document.createElement("p");
  message.className = "attachment-unavailable";
  message.textContent = "Preview unavailable";
  return message;
}

function buildResponses(responses) {
  const container = document.getElementById("detailResponses");
  if (!container) return;

  container.innerHTML = "";

  if (!responses || responses.length === 0) {
    const msg = document.createElement("p");
    msg.className = "detail-empty-msg";
    msg.textContent = "No admin responses yet.";
    container.appendChild(msg);
    return;
  }

  responses.forEach((r) => {
    const entry = document.createElement("div");
    entry.className = "response-entry";

    const avatar = document.createElement("div");
    avatar.className = "response-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "🛡️";

    const body = document.createElement("div");
    body.className = "response-body";

    const meta = document.createElement("div");
    meta.className = "response-meta";
    meta.textContent = `Admin  •  ${r.date}  ${r.time}`;

    const text = document.createElement("div");
    text.className = "response-text";
    text.textContent = r.text;

    body.appendChild(meta);
    body.appendChild(text);
    entry.appendChild(avatar);
    entry.appendChild(body);
    container.appendChild(entry);
  });
}

function buildFollowUps(followUps) {
  const container = document.getElementById("detailFollowUps");
  if (!container) return;

  container.innerHTML = "";

  if (!followUps || followUps.length === 0) {
    const msg = document.createElement("p");
    msg.className = "detail-empty-msg";
    msg.textContent = "No follow-ups yet.";
    container.appendChild(msg);
    return;
  }

  followUps.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "follow-up-entry";

    const meta = document.createElement("div");
    meta.className = "follow-up-meta";
    meta.textContent = `Resident update - ${item.date} ${item.time}`;

    const text = document.createElement("div");
    text.className = "follow-up-text";
    text.textContent = item.text;

    entry.appendChild(meta);
    entry.appendChild(text);
    container.appendChild(entry);
  });
}

function initFollowUpForm() {
  const form = document.getElementById("followUpForm");
  const textarea = document.getElementById("followUpText");
  const help = document.getElementById("followUpHelp");
  const submit = document.getElementById("followUpSubmit");
  if (!form || !textarea || !help || !submit) return;

  textarea.addEventListener("input", () => {
    help.textContent = `${textarea.value.length} / 1500`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const complaintId = form.dataset.complaintId || activeComplaintId;
    const update = textarea.value.trim();
    if (!complaintId || !update) {
      showNotification("Please enter a follow-up update.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Adding...";
    try {
      const response = await api.addComplaintFollowUp(complaintId, update);
      if (!response?.success) {
        throw new Error(response?.message || "Unable to add follow-up.");
      }
      showNotification("Follow-up added.", "success");
      await loadComplaints();
      const refreshed = complaints.find((item) => item.id === complaintId);
      if (refreshed) {
        openDetailModal(refreshed, _lastFocusedViewBtn);
      }
    } catch (error) {
      const complaint = complaints.find((item) => item.id === complaintId);
      if (!complaint) {
        showNotification(error.message || "Unable to add follow-up.", "error");
        return;
      }
      if (!isStoredLocalComplaint(complaintId)) {
        showNotification(error.message || "Unable to add follow-up.", "error");
        return;
      }
      addLocalFollowUp(complaint, update);
      showNotification(
        "Server unavailable. Follow-up saved locally for now.",
        "warning",
      );
      renderTable();
      openDetailModal(complaint, _lastFocusedViewBtn);
    } finally {
      submit.disabled = false;
      submit.textContent = "Add Follow-up";
    }
  });
}

function addLocalFollowUp(complaint, update) {
  const now = new Date();
  const followUp = {
    id: `local-follow-up-${now.getTime()}`,
    text: update,
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
  complaint.followUps = complaint.followUps || [];
  complaint.followUps.push(followUp);
  complaint.history = complaint.history || [];
  complaint.history.push({
    label: "Resident follow-up",
    status: complaint.status,
    date: followUp.date,
    time: followUp.time,
    notes: update,
  });
  persistLocalComplaintUpdate(complaint);
}

function persistLocalComplaintUpdate(complaint) {
  const stored = getStoredComplaints();
  const index = stored.findIndex(
    (item) =>
      formatComplaintNumber(item.id || item.referenceId) ===
      formatComplaintNumber(complaint.id || complaint.referenceId),
  );
  if (index >= 0) {
    stored[index] = { ...stored[index], ...complaint, pendingSync: true };
  }
  localStorage.setItem("bsccarsComplaints", JSON.stringify(stored));
}

function isStoredLocalComplaint(complaintId) {
  const stored = getStoredComplaints();
  return stored.some(
    (item) =>
      formatComplaintNumber(item.id || item.referenceId) ===
      formatComplaintNumber(complaintId),
  );
}

function buildTimeline(history) {
  const container = document.getElementById("detailTimeline");
  if (!container) return;

  container.innerHTML = "";

  if (!history || history.length === 0) {
    const msg = document.createElement("p");
    msg.className = "detail-empty-msg";
    msg.textContent = "No status history available.";
    container.appendChild(msg);
    return;
  }

  history.forEach((item) => {
    const statusKey = normalizeStatus(item.status).toLowerCase().replace(/\s+/g, "-");

    const dotClass =
      {
        pending: "dot-pending",
        "in-progress": "dot-progress",
        resolved: "dot-resolved",
      }[statusKey] || "dot-pending";

    const statusClass =
      {
        pending: "s-pending",
        "in-progress": "s-progress",
        resolved: "s-resolved",
      }[statusKey] || "s-pending";

    const timelineItem = document.createElement("div");
    timelineItem.className = "timeline-item";

    const dot = document.createElement("div");
    dot.className = `timeline-dot ${dotClass}`;
    dot.textContent = history.indexOf(item) + 1;

    const info = document.createElement("div");
    info.className = "timeline-info";

    const labelRow = document.createElement("div");
    labelRow.className = "timeline-label";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.label;

    const arrowSpan = document.createElement("span");
    arrowSpan.className = "timeline-arrow";
    arrowSpan.setAttribute("aria-hidden", "true");
    arrowSpan.textContent = "→";

    const statusSpan = document.createElement("span");
    statusSpan.className = `timeline-status ${statusClass}`;
    statusSpan.textContent = normalizeStatus(item.status);

    labelRow.appendChild(labelSpan);
    labelRow.appendChild(arrowSpan);
    labelRow.appendChild(statusSpan);

    const dateRow = document.createElement("div");
    dateRow.className = "timeline-date";
    dateRow.textContent = `${item.date}  ${item.time}`;

    info.appendChild(labelRow);
    info.appendChild(dateRow);
    if (item.notes) {
      const notes = document.createElement("div");
      notes.className = "timeline-notes";
      notes.textContent = item.notes;
      info.appendChild(notes);
    }
    timelineItem.appendChild(dot);
    timelineItem.appendChild(info);
    container.appendChild(timelineItem);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value && String(value).trim() !== "" ? value : "—";
}

function stageLabel(stage) {
  return {
    first_mediation: "First Mediation",
    second_mediation: "Second Mediation",
    conciliation: "Conciliation",
    cfa_issued: "CFA Issued",
  }[String(stage || "first_mediation").trim()] || "First Mediation";
}

function outcomeLabel(outcome) {
  return {
    pending: "Pending",
    respondent_appeared: "Respondent Appeared",
    respondent_absent: "Respondent Absent",
    settled: "Settled",
    escalated: "Escalated",
    unresolved: "Unresolved",
  }[String(outcome || "pending").trim().toLowerCase()] || "Pending";
}

function stageOutcomeBadgeClass(outcome) {
  return {
    pending: "status-pending",
    respondent_appeared: "status-progress",
    respondent_absent: "status-pending",
    settled: "status-resolved",
    escalated: "status-pending",
    unresolved: "status-pending",
  }[String(outcome || "pending").trim().toLowerCase()] || "status-pending";
}

function formatHearingDate(hearingDate, hearingTime) {
  if (!hearingDate) return "Date not set";
  let formatted = hearingDate;
  if (hearingTime) {
    formatted += " at " + String(hearingTime).slice(0, 5);
  }
  return formatted;
}

async function loadHearingProceedings(complaintId, category) {
  const card = document.getElementById("hearingProceedingsCard");
  const container = document.getElementById("detailHearingProceedings");
  if (!card || !container) return;

  // Only show for Money Debt complaints
  const isMoneyDebt = String(category || "").trim() === "Money Debt" ||
    String(category || "").toLowerCase().startsWith("money debt");
  if (!isMoneyDebt) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  container.innerHTML = '<p class="detail-empty-msg">Loading hearing proceedings...</p>';

  try {
    const response = await api.get(`/complaints/${complaintId}/hearing-notices`);
    const notices = Array.isArray(response?.data) ? response.data : [];

    if (!notices.length) {
      container.innerHTML = '<p class="detail-empty-msg">No hearing notices recorded yet.</p>';
      return;
    }

    container.innerHTML = "";
    notices.forEach((notice, index) => {
      const item = document.createElement("div");
      item.className = "hearing-proceeding-item";
      item.style.cssText = "padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);";

      const stageText = stageLabel(notice.stage || "first_mediation");
      const outcomeText = outcomeLabel(notice.outcome || "pending");
      const dateText = formatHearingDate(notice.hearing_date, notice.hearing_time);
      const servedText = notice.notice_served_method
        ? "Served via " + String(notice.notice_served_method).replace(/_/g, " ")
        : "Service pending";
      const badgeClass = stageOutcomeBadgeClass(notice.outcome || "pending");

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="color:#e0e0e0;">${escapeHtml(stageText)}</strong>
            <span style="color:rgba(255,255,255,0.5);margin-left:8px;">${escapeHtml(dateText)}</span>
          </div>
          <span class="${badgeClass}" style="padding:3px 10px;border-radius:12px;font-size:0.8rem;">${escapeHtml(outcomeText)}</span>
        </div>
        <div style="margin-top:4px;color:rgba(255,255,255,0.45);font-size:0.85rem;">
          ${escapeHtml(servedText)}
          ${notice.notice_served_at ? ' &middot; ' + new Date(notice.notice_served_at).toLocaleDateString('en-PH', {year: 'numeric', month: 'short', day: 'numeric'}) : ''}
        </div>
      `;
      container.appendChild(item);
    });
  } catch (error) {
    console.warn("Unable to load hearing proceedings.", error);
    container.innerHTML = '<p class="detail-empty-msg">Unable to load hearing proceedings.</p>';
  }
}

// Extend openDetailModal to load hearing proceedings
const _origOpenDetailModal = openDetailModal;
openDetailModal = function(complaint, triggerBtn) {
  _origOpenDetailModal(complaint, triggerBtn);
  loadHearingProceedings(complaint.id, complaint.category);
};
