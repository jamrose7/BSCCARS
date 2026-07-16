const DASHBOARD_REFRESH_MS = 5000;

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardStats();
  setInterval(loadDashboardStats, DASHBOARD_REFRESH_MS);
  window.addEventListener("focus", loadDashboardStats);
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function statusClass(status) {
  return `status-${String(status || "pending")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")}`;
}

function statusQueryValue(status) {
  return String(status || "pending")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function formatStatusLabel(status) {
  return String(status || "Pending")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStoredList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (error) {
    return [];
  }
}

function uniqueById(items) {
  const map = new Map();

  items.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });

  return Array.from(map.values());
}

async function getPendingResidentApplications() {
  const localPending = getStoredList("bsccarsPendingResidents").filter(
    (resident) =>
      !resident.archived &&
      !resident.is_archived &&
      String(resident.status || "").toLowerCase() === "pending",
  );

  if (typeof api === "undefined" || !api.getPendingResidents) {
    return localPending;
  }

  try {
    const response = await api.getPendingResidents();
    const backendPending = Array.isArray(response?.data) ? response.data : [];
    return uniqueById([...backendPending, ...localPending]);
  } catch (error) {
    return localPending;
  }
}

async function loadDashboardStats() {
  try {
    const [response, pendingResidents] = await Promise.all([
      api.getDashboardReport(),
      getPendingResidentApplications(),
    ]);
    const data = response?.data || {};
    const approvedResidents = getStoredList("bsccarsApprovedResidents").filter(
      (resident) => /^RES-2026-\d{3}$/.test(String(resident.id || "")),
    );

    setText("totalResidents", Number(data.totalResidents || 0) + approvedResidents.length);
    setText("pendingAccounts", pendingResidents.length);
    setText("totalComplaints", Number(data.totalComplaints || 0));
    setText("highPriorityComplaints", Number(data.highPriorityComplaints || 0));
    renderStatusCounts(data.complaintsByStatus || []);
    renderRecentComplaints(data.recentComplaints || []);
  } catch (error) {
    renderDashboardError(error.message || "Unable to load live dashboard stats.");
  }
}

function renderStatusCounts(statusCounts) {
  const container = document.getElementById("complaintStatusGrid");
  if (!container) return;

  if (!statusCounts.length) {
    container.innerHTML = '<p class="empty-state">No complaint status data yet.</p>';
    return;
  }

  container.innerHTML = statusCounts
    .map(
      (item) => `
        <a class="status-count-card" href="adminComplaints.html?status=${encodeURIComponent(statusQueryValue(item.status))}">
          <strong>${escapeHtml(item.total)}</strong>
          <span>${escapeHtml(item.status)}</span>
        </a>
      `,
    )
    .join("");
}

function renderRecentComplaints(complaints) {
  const tbody = document.getElementById("recentComplaintsBody");
  if (!tbody) return;

  if (!complaints.length) {
    tbody.innerHTML = `
      <tr>
        <td class="empty-state" colspan="4">No complaints have been submitted yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = complaints
    .map(
      (complaint) => `
        <tr>
          <td>${escapeHtml(complaint.resident || "Resident")}</td>
          <td>${escapeHtml(complaint.title || "Untitled complaint")}</td>
          <td>${escapeHtml(complaint.category || "Uncategorized")}</td>
          <td>
            <span class="status-pill ${statusClass(complaint.status)}">
              ${escapeHtml(formatStatusLabel(complaint.status))}
            </span>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderDashboardError(message) {
  setText("totalResidents", "--");
  setText("pendingAccounts", "--");
  setText("totalComplaints", "--");
  setText("highPriorityComplaints", "--");

  const statusGrid = document.getElementById("complaintStatusGrid");
  if (statusGrid) {
    statusGrid.innerHTML = `<p class="error-state">${escapeHtml(message)}</p>`;
  }

  const tbody = document.getElementById("recentComplaintsBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td class="error-state" colspan="4">${escapeHtml(message)}</td>
      </tr>
    `;
  }
}
