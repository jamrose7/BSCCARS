document.addEventListener("DOMContentLoaded", () => {
  renderArchivedUsers();
  loadActivityLogs();
  initArchivedToggle();
});

const userIdYear = "2026";
const activityLogsKey = "bsccarsAdminUserActivityLogs";
let pendingDeleteUserId = null;

function formatUserId(sequence) {
  return `ADM-${userIdYear}-${String(sequence).padStart(3, "0")}`;
}

function collectExistingUserIds() {
  const tableIds = Array.from(document.querySelectorAll("#usersBody tr td:first-child"))
    .map((cell) => cell.textContent.trim());
  const archivedIds = getArchivedUsers().map((user) => user.id);
  return [...tableIds, ...archivedIds].filter((id) => /^ADM-2026-\d{3}$/.test(id));
}

function generateNextUserId() {
  const sequences = collectExistingUserIds().map((id) => Number(id.slice(-3)));
  const nextSequence = sequences.length ? Math.max(...sequences) + 1 : 1;
  return formatUserId(nextSequence);
}

function getCurrentAdminName() {
  try {
    const user = JSON.parse(localStorage.getItem("user")) || {};
    return user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : "Super Admin";
  } catch (error) {
    return "Super Admin";
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

function searchUsers() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const table = document.getElementById("usersBody");
  const rows = table.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName("td");
    let found = false;

    for (let j = 0; j < cells.length; j++) {
      const cellText = cells[j].textContent.toLowerCase();
      if (cellText.includes(searchTerm)) {
        found = true;
        break;
      }
    }

    rows[i].style.display = found ? "" : "none";
  }
}

function viewUser(userId) {
  alert(
    `Viewing user ${userId} details.\nUser detail view feature coming soon.`,
  );
}

function editUser(userId) {
  alert(`Editing user ${userId}.\nUser edit feature coming soon.`);
}

function deleteUser(userId) {
  pendingDeleteUserId = userId;
  const modal = document.getElementById("deleteUserModal");
  const message = document.getElementById("deleteUserMessage");
  if (message) {
    message.textContent = `Move user ${userId} to the archive? The account will be hidden from the active list and can be restored later.`;
  }
  if (modal) {
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
}

function openDeleteUserModal(userId) {
  deleteUser(userId);
}

function confirmDeleteUser() {
  if (!pendingDeleteUserId) {
    return;
  }

  const userId = pendingDeleteUserId;
  pendingDeleteUserId = null;
  cancelDeleteUser();

  const rows = Array.from(document.querySelectorAll("#usersBody tr"));
  for (const row of rows) {
    if (row.cells[0]?.textContent.trim() === userId) {
      archiveUserFromRow(row);
      row.remove();
      logActivity("Moved user account to archive", userId);
      window.BSCCARSNotifications?.add?.({
        title: "User moved to archive",
        message: `User ${userId} was archived and can be restored later.`,
      });
      renderArchivedUsers();
      return;
    }
  }

  renderArchivedUsers();
}

function cancelDeleteUser() {
  const modal = document.getElementById("deleteUserModal");
  if (modal) {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }
}

function getArchivedUsers() {
  try {
    return JSON.parse(localStorage.getItem("bsccarsArchivedUsers")) || [];
  } catch (error) {
    return [];
  }
}

function saveArchivedUsers(users) {
  localStorage.setItem("bsccarsArchivedUsers", JSON.stringify(users));
}

function logActivity(action, target) {
  const logs = getActivityLogs();
  const now = new Date();
  const newLog = {
    action,
    by: getCurrentAdminName(),
    target,
    date: now.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
  logs.unshift(newLog);
  saveActivityLogs(logs);
  renderActivityLogs();
}

function getActivityLogs() {
  try {
    return JSON.parse(localStorage.getItem(activityLogsKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveActivityLogs(logs) {
  localStorage.setItem(activityLogsKey, JSON.stringify(logs));
}

function renderActivityLogs() {
  const body = document.getElementById("activityLogBody");
  if (!body) return;

  const logs = getActivityLogs();
  renderActivityLogRows(logs);
}

async function loadActivityLogs() {
  const localLogs = getActivityLogs();
  if (typeof api === "undefined" || !api.getSystemActivityLogs) {
    renderActivityLogRows(localLogs);
    return;
  }

  try {
    const response = await api.getSystemActivityLogs();
    const backendLogs = Array.isArray(response?.data) ? response.data : [];
    renderActivityLogRows([
      ...backendLogs.map(normalizeBackendLog),
      ...localLogs,
    ]);
  } catch (error) {
    renderActivityLogRows(localLogs);
  }
}

function normalizeBackendLog(log) {
  const timestamp = new Date(log.timestamp || Date.now());
  return {
    action: log.action || "",
    by: log.user || "System",
    target: [log.targetType, log.targetId].filter(Boolean).join(" ") || log.details || "-",
    date: timestamp.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }),
    time: timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function renderActivityLogRows(logs) {
  const body = document.getElementById("activityLogBody");
  if (!body) return;

  if (!logs.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color: rgba(255,255,255,0.65); padding: 18px;">
          No user activity logged yet.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = logs
    .map((log) => `
      <tr>
        <td>${escapeHtml(log.action)}</td>
        <td>${escapeHtml(log.by)}</td>
        <td>${escapeHtml(log.target)}</td>
        <td>${escapeHtml(log.date)}</td>
        <td>${escapeHtml(log.time)}</td>
      </tr>
    `)
    .join("");
}

function initArchivedToggle() {
  const checkbox = document.getElementById("showArchivedUsers");
  const archivedSection = document.querySelector(".archive-panel");
  if (!checkbox || !archivedSection) return;

  archivedSection.style.display = "none";
  checkbox.addEventListener("change", () => {
    archivedSection.style.display = checkbox.checked ? "block" : "none";
  });
}

function archiveUser(userId) {
  const confirmArchive = confirm(
    `Archive user ${userId}? The account will be removed from the active list but can be restored later.`,
  );
  if (!confirmArchive) {
    return;
  }

  const rows = Array.from(document.querySelectorAll("#usersBody tr"));
  for (const row of rows) {
    if (row.cells[0]?.textContent.trim() === userId) {
      archiveUserFromRow(row);
      row.remove();
      logActivity("Archived user account", userId);
      window.BSCCARSNotifications?.add?.({
        title: "User archived",
        message: `User ${userId} was moved to the archive and can be restored later.`,
      });
      renderArchivedUsers();
      return;
    }
  }
}

function archiveUserFromRow(row) {
  const user = {
    id: row.cells[0]?.textContent.trim() || "",
    firstName: row.cells[1]?.textContent.trim() || "",
    lastName: row.cells[2]?.textContent.trim() || "",
    middleName: row.cells[3]?.textContent.trim() || "",
    email: row.cells[4]?.textContent.trim() || "",
    role: row.cells[5]?.textContent.trim() || "",
    is_archived: true,
    archivedAt: new Date().toISOString(),
  };
  const users = getArchivedUsers().filter((item) => item.id !== user.id);
  users.unshift(user);
  saveArchivedUsers(users);
}

function restoreUser(userId) {
  const archivedUsers = getArchivedUsers();
  const user = archivedUsers.find((item) => item.id === userId);
  if (!user) {
    return;
  }

  addUserRow(user);
  saveArchivedUsers(archivedUsers.filter((item) => item.id !== userId));
  logActivity("Restored archived user account", userId);
  window.BSCCARSNotifications?.add?.({
    title: "User restored",
    message: `User ${userId} was restored from the archive.`,
  });
  renderArchivedUsers();
}

function addUserRow(user) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${escapeHtml(user.id)}</td>
    <td>${escapeHtml(user.firstName)}</td>
    <td>${escapeHtml(user.lastName)}</td>
    <td>${escapeHtml(user.middleName || "-")}</td>
    <td>${escapeHtml(user.email)}</td>
    <td>${escapeHtml(user.role)}</td>
    <td><span class="status-badge status-active">Active</span></td>
    <td>
      <button class="action-btn" onclick="viewUser('${escapeHtml(user.id)}')" title="View">👁️</button>
      <button class="action-btn" onclick="editUser('${escapeHtml(user.id)}')" title="Edit">✏️</button>
      <button class="action-btn action-archive" onclick="archiveUser('${escapeHtml(user.id)}')" title="Archive">📦</button>
      <button class="action-btn action-delete" onclick="openDeleteUserModal('${escapeHtml(user.id)}')" title="Delete">🗑️</button>
    </td>
  `;
  document.getElementById("usersBody").prepend(row);
}

function renderArchivedUsers() {
  const archiveList = document.getElementById("usersArchiveList");
  if (!archiveList) {
    return;
  }

  const users = getArchivedUsers();
  if (!users.length) {
    archiveList.innerHTML = '<p style="color: rgba(238,247,247,0.72);">No archived user accounts yet.</p>';
    return;
  }

  archiveList.innerHTML = users
    .map(
      (user) => `
        <div class="archive-card">
          <div>
            <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
            <span>${escapeHtml(user.role)} - ${escapeHtml(user.email)}</span>
          </div>
          <div class="archive-actions">
            <button type="button" data-restore-user="${escapeHtml(user.id)}">Restore</button>
            <button type="button" data-permanent-delete-user="${escapeHtml(user.id)}">Delete</button>
          </div>
        </div>
      `,
    )
    .join("");

  archiveList.querySelectorAll("[data-restore-user]").forEach((button) => {
    button.addEventListener("click", () => restoreUser(button.dataset.restoreUser));
  });

  archiveList.querySelectorAll("[data-permanent-delete-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.dataset.permanentDeleteUser;
      if (!userId) return;
      const confirmed = confirm(`Permanently delete archived user ${userId}? This cannot be undone.`);
      if (!confirmed) return;
      const archived = getArchivedUsers().filter((user) => user.id !== userId);
      saveArchivedUsers(archived);
      logActivity("Permanently deleted archived user", userId);
      window.BSCCARSNotifications?.add?.({
        title: "Archived user permanently deleted",
        message: `User ${userId} was permanently deleted from the archive.`,
      });
      renderArchivedUsers();
    });
  });
}

function openAddUserModal() {
  const modal = document.getElementById("addUserModal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeAddUserModal() {
  const modal = document.getElementById("addUserModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function saveNewUser(event) {
  event.preventDefault();

  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("email");
  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const role = "Assistant Admin";

  if (!firstName || !lastName || !email) {
    alert("Please fill in all fields.");
    return;
  }

  if (typeof Validators !== "undefined" && !Validators.email(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  const userId = generateNextUserId();
  addUserRow({ id: userId, firstName, lastName, middleName: "-", email, role });
  closeAddUserModal();

  event.target.reset();
}

function exportPDF() {
  const users = getVisibleUsersForExport();
  if (!users.length) {
    showUserExportStatus("There are no visible users to export.");
    return;
  }
  if (!window.jspdf?.jsPDF) {
    showUserExportStatus("PDF library is unavailable. Check your connection and try again.");
    return;
  }

  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const widths = [24, 38, 38, 65, 44, usableWidth - 209];
  const headers = ["User ID", "First Name", "Last Name", "Email", "Role", "Status"];
  const user = typeof api !== "undefined" ? api.getStoredUser?.() || {} : {};
  const generatedBy = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(" ") || "Administrator";
  const search = document.getElementById("searchInput")?.value.trim();
  let page = 1;
  let y = 18;

  const footer = () => {
    pdf.setDrawColor(190);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text("BSCCARS — Confidential user management export", margin, pageHeight - 7);
    pdf.text(`Page ${page}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    pdf.setTextColor(0);
  };
  const tableHeader = () => {
    pdf.setFillColor(20, 82, 100);
    pdf.rect(margin, y, usableWidth, 8, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    let x = margin;
    headers.forEach((header, index) => {
      pdf.text(header, x + 2, y + 5.2);
      x += widths[index];
    });
    pdf.setTextColor(0);
    y += 8;
  };
  const nextPage = () => {
    footer();
    pdf.addPage();
    page += 1;
    y = 18;
    pdf.setFontSize(11);
    pdf.text("User Management Export (continued)", margin, y);
    y += 7;
    tableHeader();
  };

  pdf.setFontSize(16);
  pdf.text("BSCCARS", margin, y);
  pdf.setFontSize(9);
  pdf.setTextColor(80);
  pdf.text("Barangay Sillon Community Complaint and Response System", margin, y + 5);
  pdf.setTextColor(0);
  y += 15;
  pdf.setFontSize(14);
  pdf.text("User Management Export", margin, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  pdf.text(`Generated by: ${generatedBy}`, margin, y + 5);
  pdf.text(`Visible users: ${users.length}${search ? ` (search: ${search})` : ""}`, margin, y + 10);
  y += 18;
  tableHeader();

  users.forEach((row, rowIndex) => {
    const values = [row.id, row.firstName, row.lastName, row.email, row.role, row.status];
    pdf.setFontSize(8);
    const cells = values.map((value, index) => pdf.splitTextToSize(value || "—", widths[index] - 4));
    const height = Math.max(7, ...cells.map((lines) => lines.length * 4 + 3));
    if (y + height > pageHeight - 16) nextPage();
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(247, 250, 251);
      pdf.rect(margin, y, usableWidth, height, "F");
    }
    let x = margin;
    cells.forEach((lines, index) => {
      pdf.text(lines, x + 2, y + 4.5);
      x += widths[index];
    });
    pdf.setDrawColor(220);
    pdf.line(margin, y + height, pageWidth - margin, y + height);
    y += height;
  });
  footer();
  pdf.save("users-export.pdf");
  showUserExportStatus("PDF export downloaded.");
}

function exportCSV() {
  const users = getVisibleUsersForExport();
  if (!users.length) {
    showUserExportStatus("There are no visible users to export.");
    return;
  }
  const headers = ["User ID", "First Name", "Last Name", "Middle Name", "Email", "Role", "Status"];
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...users.map((user) => [user.id, user.firstName, user.lastName, user.middleName, user.email, user.role, user.status])]
    .map((row) => row.map(quote).join(","))
    .join("\r\n");
  downloadUserExport(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), "users-export.csv");
  showUserExportStatus("CSV export downloaded.");
}

function getVisibleUsersForExport() {
  return Array.from(document.querySelectorAll("#usersBody tr"))
    .filter((row) => row.style.display !== "none" && row.cells.length >= 7)
    .map((row) => ({
      id: row.cells[0].textContent.trim(),
      firstName: row.cells[1].textContent.trim(),
      lastName: row.cells[2].textContent.trim(),
      middleName: row.cells[3].textContent.trim(),
      email: row.cells[4].textContent.trim(),
      role: row.cells[5].textContent.trim(),
      status: row.cells[6].textContent.trim(),
    }));
}

function downloadUserExport(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function showUserExportStatus(message) {
  const status = document.getElementById("userExportStatus");
  if (!status) return;
  status.textContent = message;
  clearTimeout(showUserExportStatus.timeout);
  showUserExportStatus.timeout = setTimeout(() => { status.textContent = ""; }, 4000);
}
