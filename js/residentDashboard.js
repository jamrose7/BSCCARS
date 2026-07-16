const RESIDENT_DASHBOARD_REFRESH_MS = 5000;

document.addEventListener("DOMContentLoaded", () => {
  loadResidentDashboardStats();
  setInterval(loadResidentDashboardStats, RESIDENT_DASHBOARD_REFRESH_MS);
  window.addEventListener("focus", loadResidentDashboardStats);
});

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusTotal(statusCounts, statusName) {
  const normalized = statusName.toLowerCase();
  return statusCounts
    .filter((item) => String(item.status || "").toLowerCase() === normalized)
    .reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function normalizeStatus(status) {
  const key = String(status || "pending").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (["resolved", "closed", "completed"].includes(key)) return "Resolved";
  if (["in-progress", "progress", "ongoing"].includes(key)) return "In Progress";
  return "Pending";
}

function currentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.id || "";
  } catch (error) {
    return "";
  }
}

async function loadResidentDashboardStats() {
  try {
    const userId = currentUserId();
    const response = await api.getComplaints(userId ? { submitterId: userId } : {});
    const recentComplaints = Array.isArray(response?.data) ? response.data : [];
    const statusCounts = ["Pending", "In Progress", "Resolved"].map((status) => ({
      status,
      total: recentComplaints.filter((complaint) => normalizeStatus(complaint.status) === status).length,
    }));

    setText("residentTotalComplaints", recentComplaints.length);
    setText("residentPendingComplaints", statusTotal(statusCounts, "Pending"));
    setText("residentProgressComplaints", statusTotal(statusCounts, "In Progress"));
    setText("residentResolvedComplaints", statusTotal(statusCounts, "Resolved"));
    setText("residentHighPriorityComplaints", recentComplaints.filter((complaint) => String(complaint.priority || "").toLowerCase() === "high").length);
    renderRecentActivity(recentComplaints);
  } catch (error) {
    setText("residentTotalComplaints", "--");
    setText("residentPendingComplaints", "--");
    setText("residentProgressComplaints", "--");
    setText("residentResolvedComplaints", "--");
    setText("residentHighPriorityComplaints", "--");
    setText("residentLastAction", error.message || "Unable to load live complaint activity.");
  }
}

function renderRecentActivity(complaints) {
  const list = document.getElementById("residentRecentActivity");
  const lastAction = document.getElementById("residentLastAction");

  if (!complaints.length) {
    if (list) {
      list.innerHTML = "<li>No complaint activity yet.</li>";
    }
    if (lastAction) {
      lastAction.textContent = "No recent complaint activity yet.";
    }
    return;
  }

  const latest = complaints[0];
  if (lastAction) {
    lastAction.innerHTML = `Last Admin Action: <strong>#${escapeHtml(
      latest.id || "",
    )}</strong> - ${escapeHtml(normalizeStatus(latest.status))}`;
  }

  if (list) {
    list.innerHTML = complaints
      .slice(0, 3)
      .map(
        (complaint) => `
          <li>
            #${escapeHtml(complaint.id || "")} - ${escapeHtml(
              complaint.title || "Untitled complaint",
            )}
            (${escapeHtml(normalizeStatus(complaint.status))})
          </li>
        `,
      )
      .join("");
  }
}
