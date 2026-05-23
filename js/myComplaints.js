"use strict";

const complaints = [
  {
    id: "127",
    title: "Loud music past midnight",
    category: "Public Disturbance",
    priority: "High",
    status: "In Progress",
    date: "2026-01-19",
    time: "9:30 PM",
    purok: "Purok Bilabid 1",
    details: "Loud music played repeatedly past midnight.",
    confidential: "Yes (Public-hidden)",
    attachments: ["Image_127.jpg", "Video_127.mp4"],
    responses: [
      {
        date: "2026-01-19",
        time: "9:30 PM",
        text: "Complaint acknowledged. We have dispatched an officer to investigate.",
      },
    ],
    history: [
      { label: "Submitted",    status: "Pending",     date: "2026-01-19", time: "9:30 PM" },
      { label: "Acknowledged", status: "In Progress", date: "2026-01-19", time: "9:45 PM" },
    ],
  },
  {
    id: "119",
    title: "Illegal dumping near canal",
    category: "Waste Management",
    priority: "Normal",
    status: "Resolved",
    date: "2026-01-08",
    time: "3:10 PM",
    purok: "Purok Bilabid 3",
    details: "Garbage being dumped beside the canal regularly.",
    confidential: "Yes (Public-hidden)",
    attachments: ["Image_119.jpg"],
    responses: [
      {
        date: "2026-01-10",
        time: "10:00 AM",
        text: "Clean-up crew has been deployed. Area has been cleared.",
      },
    ],
    history: [
      { label: "Submitted",  status: "Pending",     date: "2026-01-08", time: "3:10 PM" },
      { label: "Reviewed",   status: "In Progress", date: "2026-01-09", time: "8:00 AM" },
      { label: "Resolved",   status: "Resolved",    date: "2026-01-10", time: "10:30 AM" },
    ],
  },
  {
    id: "128",
    title: "Vehicles blocking driveways",
    category: "Illegal Parking",
    priority: "Normal",
    status: "Pending",
    date: "2026-01-07",
    time: "10:00 AM",
    purok: "Purok Aguma-a 2",
    details: "Multiple vehicles blocking residential driveways on Purok 2.",
    confidential: "No",
    attachments: [],
    responses: [],
    history: [
      { label: "Submitted", status: "Pending", date: "2026-01-07", time: "10:00 AM" },
    ],
  },
];

let _lastFocusedViewBtn = null;

document.addEventListener("DOMContentLoaded", () => {
  renderTable();
  initSignOut();
  initModalClose();
  initEscapeKey();
});

function initSignOut() {
  const btn = document.getElementById("signoutBtn") || document.querySelector(".signout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (confirm("Are you sure you want to sign out?")) {
      sessionStorage.removeItem("residentSignedIn");
      window.location.href = "sign_in.html";
    }
  });
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

  setText("detailModalTitle", `Complaint #${complaint.id} — Detail View`);
  setText("detailId",          complaint.id);
  setText("detailCategory",    complaint.category);
  setText("detailPurok",       complaint.purok);
  setText("detailPriority",    complaint.priority);
  setText("detailConfidential",complaint.confidential);
  setText("detailDate",        complaint.date);
  setText("detailTime",        complaint.time);
  setText("detailDetails",     complaint.details);

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
    msg.textContent = "No attachments.";
    container.appendChild(msg);
    return;
  }

  attachments.forEach((filename) => {
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
    container.appendChild(tag);
  });
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

    const dotClass = {
      "pending":     "dot-pending",
      "in-progress": "dot-progress",
      "resolved":    "dot-resolved",
    }[statusKey] || "dot-pending";

    const statusClass = {
      "pending":     "s-pending",
      "in-progress": "s-progress",
      "resolved":    "s-resolved",
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