"use strict";

const sampleComplaints = [
  {
    id: "CMP-2026-0001",
    title: "Loud music past midnight",
    category: "Noise and Public Disturbance",
    priority: "High",
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

function getStoredComplaints() {
  try {
    return JSON.parse(localStorage.getItem("bsccarsComplaints")) || [];
  } catch (error) {
    return [];
  }
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
    responses: complaint.adminNotes
      ? [
          {
            date: new Date().toISOString().slice(0, 10),
            time: "",
            text: complaint.adminNotes,
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
    }));
  } catch (error) {
    complaints = [...localComplaints, ...sampleComplaints].map((complaint) => ({
      ...complaint,
      status: normalizeStatus(complaint.status),
      id: formatComplaintNumber(complaint.id || complaint.referenceId),
      referenceId: formatComplaintNumber(complaint.referenceId || complaint.id),
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
  buildTimeline(complaint.history);

  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  const titleEl = document.getElementById("detailModalTitle");
  if (titleEl) {
    titleEl.setAttribute("tabindex", "-1");
    titleEl.focus();
  }
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
    const statusKey = item.status.toLowerCase().replace(/\s+/g, "-");

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
    statusSpan.textContent = item.status;

    labelRow.appendChild(labelSpan);
    labelRow.appendChild(arrowSpan);
    labelRow.appendChild(statusSpan);

    const dateRow = document.createElement("div");
    dateRow.className = "timeline-date";
    dateRow.textContent = `${item.date}  ${item.time}`;

    info.appendChild(labelRow);
    info.appendChild(dateRow);
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
