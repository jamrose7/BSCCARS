/**

 * Activate/Deactivate is backend-backed because it gates sign-in eligibility.
 * All other actions on this page remain a local-only prototype.
 * Rotation order: activate the incoming admin first, confirm sign-in works,
 * then deactivate the outgoing admin. The backend guarantees the system is
 * never left without an active Super Admin.
 */
document.addEventListener("DOMContentLoaded", function () {
  renderArchivedUsers();
  loadActivityLogs();
  initArchivedToggle();
  loadAdminUsers();
  initNewAdminPasswordToggle();
});

function initNewAdminPasswordToggle() {
  var toggle = document.getElementById("toggleNewAdminPassword");
  var input = document.getElementById("newAdminPassword");
  if (!toggle || !input) return;

  function toggleVisibility() {
    var isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.classList.toggle("closed", !isHidden);
    toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  }

  toggle.addEventListener("click", toggleVisibility);
  toggle.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleVisibility();
    }
  });
}

var userIdYear = "2026";
var activityLogsKey = "bsccarsAdminUserActivityLogs";
var pendingDeleteUserId = null;

function actSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
}
function deactSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
}
function archiveSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg>';
}

function formatUserId(seq) {
  return "ADM-" + userIdYear + "-" + String(seq).padStart(3, "0");
}
function collectExistingUserIds() {
  var ids = Array.from(
    document.querySelectorAll("#usersBody tr td:first-child"),
  ).map(function (c) {
    return c.textContent.trim();
  });
  return ids
    .concat(
      getArchivedUsers().map(function (u) {
        return u.id;
      }),
    )
    .filter(function (id) {
      return /^ADM-2026-\d{3}$/.test(id);
    });
}
function generateNextUserId() {
  var seq = collectExistingUserIds().map(function (id) {
    return Number(id.slice(-3));
  });
  return formatUserId(seq.length ? Math.max.apply(null, seq) + 1 : 1);
}
function getCurrentAdminName() {
  try {
    var u = JSON.parse(localStorage.getItem("user")) || {};
    return u.firstName && u.lastName
      ? u.firstName + " " + u.lastName
      : "Super Admin";
  } catch (e) {
    return "Super Admin";
  }
}
function escapeHtml(v) {
  var s = String(v || "");
  s = s.replace(/&/g, String.fromCharCode(38) + "amp;");
  s = s.replace(/</g, String.fromCharCode(38) + "lt;");
  s = s.replace(/>/g, String.fromCharCode(38) + "gt;");
  s = s.replace(/"/g, String.fromCharCode(38) + "quot;");
  s = s.replace(/'/g, String.fromCharCode(38) + "#039;");
  return s;
}
async function loadAdminUsers() {
  try {
    var res = await api.getAdminUsers();
    renderAdminUsers(res && res.data ? res.data : []);
  } catch (e) {
    console.error("loadAdminUsers error", e);
  }
}
function actionsHtml(user, active) {
  var h = "";
  if (!active) {
    h +=
      '<button class="action-btn status-activate" onclick="handleActivate(\'' +
      user.id +
      '\')" title="Activate">' +
      actSvg() +
      "</button>";
  }
  if (active) {
    h +=
      '<button class="action-btn status-deactivate" onclick="handleDeactivate(\'' +
      user.id +
      '\')" title="Deactivate">' +
      deactSvg() +
      "</button>";
  }
  h +=
    '<button class="action-btn action-archive" onclick="archiveUser(\'' +
    escapeHtml(user.id) +
    '\')" title="Archive">' +
    archiveSvg() +
    "</button>";
  return h;
}
function renderAdminUsers(admins) {
  var tbody = document.getElementById("usersBody");
  if (!tbody) return;
  var html = "";
  for (var i = 0; i < admins.length; i++) {
    var u = admins[i];
    var active = (u.account_status || "active") === "active";
    var label = active ? "Active" : "Inactive";
    var cls = active ? "status-active" : "status-inactive";
    var role = u.role === "super_admin" ? "Super Admin" : "Assistant Admin";
    html += "<tr>";
    html += "<td>" + escapeHtml(u.id) + "</td>";
    html += "<td>" + escapeHtml(u.first_name) + "</td>";
    html += "<td>" + escapeHtml(u.last_name) + "</td>";
    html += "<td>-</td>";
    html += "<td>" + escapeHtml(u.email) + "</td>";
    html += "<td>" + escapeHtml(role) + "</td>";
    html +=
      '<td><span class="status-badge ' + cls + '">' + label + "</span></td>";
    html += "<td>" + actionsHtml(u, active) + "</td>";
    html += "</tr>";
  }
  tbody.innerHTML = html;
}
async function handleActivate(id) {
  try {
    var r = await api.activateAdminUser(id);
    if (r.success) await loadAdminUsers();
  } catch (e) {
    alert(e.message || "Activation failed");
  }
}
async function handleDeactivate(id) {
  try {
    var r = await api.deactivateAdminUser(id);
    if (r.success) await loadAdminUsers();
  } catch (e) {
    alert(e.message || "Deactivation failed");
  }
}
function searchUsers() {
  var q = document.getElementById("searchInput").value.toLowerCase();
  var rows = document.getElementById("usersBody").getElementsByTagName("tr");
  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].getElementsByTagName("td");
    var found = false;
    for (var j = 0; j < cells.length; j++) {
      if (cells[j].textContent.toLowerCase().includes(q)) {
        found = true;
        break;
      }
    }
    rows[i].style.display = found ? "" : "none";
  }
}
function viewUser(id) {
  alert("View user " + id + " - coming soon.");
}
function editUser(id) {
  alert("Edit user " + id + " - coming soon.");
}
function deleteUser(id) {
  pendingDeleteUserId = id;
  var modal = document.getElementById("deleteUserModal");
  var msg = document.getElementById("deleteUserMessage");
  if (msg)
    msg.textContent =
      "Move user " + id + " to the archive? It can be restored later.";
  if (modal) {
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
}
function openDeleteUserModal(id) {
  deleteUser(id);
}
function confirmDeleteUser() {
  if (!pendingDeleteUserId) return;
  var id = pendingDeleteUserId;
  pendingDeleteUserId = null;
  cancelDeleteUser();
  var rows = Array.from(document.querySelectorAll("#usersBody tr"));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].cells[0] && rows[i].cells[0].textContent.trim() === id) {
      archiveUserFromRow(rows[i]);
      rows[i].remove();
      logActivity("Moved user account to archive", id);
      if (window.BSCCARSNotifications && window.BSCCARSNotifications.add)
        window.BSCCARSNotifications.add({
          title: "User moved to archive",
          message: "User " + id + " archived.",
        });
      renderArchivedUsers();
      return;
    }
  }
  renderArchivedUsers();
}
function cancelDeleteUser() {
  var m = document.getElementById("deleteUserModal");
  if (m) {
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
  }
}
function getArchivedUsers() {
  try {
    return JSON.parse(localStorage.getItem("bsccarsArchivedUsers")) || [];
  } catch (e) {
    return [];
  }
}
function saveArchivedUsers(u) {
  localStorage.setItem("bsccarsArchivedUsers", JSON.stringify(u));
}
function logActivity(action, target) {
  var logs = getActivityLogs();
  var now = new Date();
  logs.unshift({
    action: action,
    by: getCurrentAdminName(),
    target: target,
    date: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  });
  saveActivityLogs(logs);
  renderActivityLogs();
}
function getActivityLogs() {
  try {
    return JSON.parse(localStorage.getItem(activityLogsKey)) || [];
  } catch (e) {
    return [];
  }
}
function saveActivityLogs(l) {
  localStorage.setItem(activityLogsKey, JSON.stringify(l));
}
function renderActivityLogs() {
  var body = document.getElementById("activityLogBody");
  if (!body) return;
  renderActivityLogRows(getActivityLogs());
}
async function loadActivityLogs() {
  var local = getActivityLogs();
  if (typeof api === "undefined" || !api.getSystemActivityLogs) {
    renderActivityLogRows(local);
    return;
  }
  try {
    var res = await api.getSystemActivityLogs();
    var backend = Array.isArray(res && res.data) ? res.data : [];
    renderActivityLogRows(backend.map(normalizeBackendLog).concat(local));
  } catch (e) {
    renderActivityLogRows(local);
  }
}
function normalizeBackendLog(log) {
  var ts = new Date(log.timestamp || Date.now());
  return {
    action: log.action || "",
    by: log.user || "System",
    target:
      [log.targetType, log.targetId].filter(Boolean).join(" ") ||
      log.details ||
      "-",
    date: ts.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: ts.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}
function renderActivityLogRows(logs) {
  var body = document.getElementById("activityLogBody");
  if (!body) return;
  if (!logs.length) {
    body.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.65);padding:18px;">No activity logged yet.</td></tr>';
    return;
  }
  body.innerHTML = logs
    .map(function (l) {
      return (
        "<tr><td>" +
        escapeHtml(l.action) +
        "</td><td>" +
        escapeHtml(l.by) +
        "</td><td>" +
        escapeHtml(l.target) +
        "</td><td>" +
        escapeHtml(l.date) +
        "</td><td>" +
        escapeHtml(l.time) +
        "</td></tr>"
      );
    })
    .join("");
}
function initArchivedToggle() {
  var cb = document.getElementById("showArchivedUsers");
  var panel = document.querySelector(".archive-panel");
  if (!cb || !panel) return;
  panel.style.display = "none";
  cb.addEventListener("change", function () {
    panel.style.display = cb.checked ? "block" : "none";
  });
}
function archiveUser(userId) {
  if (!confirm("Archive user " + userId + "? It can be restored later.")) return;
  var rows = Array.from(document.querySelectorAll("#usersBody tr"));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].cells[0] && rows[i].cells[0].textContent.trim() === userId) {
      var role = rows[i].cells[5].textContent.trim(); // grab role BEFORE removing row
      archiveUserFromRow(rows[i]);
      rows[i].remove();
      logActivity("Archived " + role + " account", userId);
      if (window.BSCCARSNotifications && window.BSCCARSNotifications.add)
        window.BSCCARSNotifications.add({
          title: role + " archived",
          message: role + " account " + userId + " was archived.",
        });
      renderArchivedUsers();
      return;
    }
  }
}
function archiveUserFromRow(row) {
  var user = {
    id: row.cells[0].textContent.trim(),
    firstName: row.cells[1].textContent.trim(),
    lastName: row.cells[2].textContent.trim(),
    middleName: row.cells[3].textContent.trim(),
    email: row.cells[4].textContent.trim(),
    role: row.cells[5].textContent.trim(),
    is_archived: true,
    archivedAt: new Date().toISOString(),
  };
  var users = getArchivedUsers().filter(function (u) {
    return u.id !== user.id;
  });
  users.unshift(user);
  saveArchivedUsers(users);
}
function restoreUser(userId) {
  var archived = getArchivedUsers();
  var user = archived.find(function (u) {
    return u.id === userId;
  });
  if (!user) return;
  addUserRow(user);
  saveArchivedUsers(
    archived.filter(function (u) {
      return u.id !== userId;
    }),
  );
  logActivity("Restored archived user account", userId);
  if (window.BSCCARSNotifications && window.BSCCARSNotifications.add)
    window.BSCCARSNotifications.add({
      title: "User restored",
      message: "User " + userId + " was restored.",
    });
  renderArchivedUsers();
}
function addUserRow(user) {
  var row = document.createElement("tr");
  row.innerHTML =
    "<td>" +
    escapeHtml(user.id) +
    "</td><td>" +
    escapeHtml(user.firstName) +
    "</td><td>" +
    escapeHtml(user.lastName) +
    "</td><td>" +
    escapeHtml(user.middleName || "-") +
    "</td><td>" +
    escapeHtml(user.email) +
    "</td><td>" +
    escapeHtml(user.role) +
    '</td><td><span class="status-badge status-active">Active</span></td><td>' +
    '<button class="action-btn action-archive" onclick="archiveUser(\'' +
    escapeHtml(user.id) +
    '\')" title="Archive">' +
    archiveSvg() +
    "</button></td>";
  document.getElementById("usersBody").prepend(row);
}
function renderArchivedUsers() {
  var list = document.getElementById("usersArchiveList");
  if (!list) return;
  var users = getArchivedUsers();
  if (!users.length) {
    list.innerHTML =
      '<p style="color:rgba(238,247,247,0.72);">No archived user accounts yet.</p>';
    return;
  }
  list.innerHTML = users
    .map(function (u) {
      return (
        '<div class="archive-card"><div><strong>' +
        escapeHtml(u.firstName) +
        " " +
        escapeHtml(u.lastName) +
        "</strong><span>" +
        escapeHtml(u.role) +
        " - " +
        escapeHtml(u.email) +
        '</span></div><div class="archive-actions"><button type="button" data-restore-user="' +
        escapeHtml(u.id) +
        '">Restore</button></div>'
      );
    })
    .join("");
  list.querySelectorAll("[data-restore-user]").forEach(function (b) {
    b.addEventListener("click", function () {
      restoreUser(b.dataset.restoreUser);
    });
  });
}
function openAddUserModal() {
  var m = document.getElementById("addUserModal");
  if (m) m.classList.add("show");
}
function closeAddUserModal() {
  var m = document.getElementById("addUserModal");
  if (m) m.classList.remove("show");
}
async function saveNewUser(e) {
  e.preventDefault();
  var fn = document.getElementById("firstName").value.trim();
  var ln = document.getElementById("lastName").value.trim();
  var em = document.getElementById("email").value.trim();
  var role = document.getElementById("role").value;
  var pw = document.getElementById("newAdminPassword").value;

  if (!fn || !ln || !em || !pw) {
    alert("Please fill in all fields.");
    return;
  }
  if (typeof Validators !== "undefined" && !Validators.email(em)) {
    alert("Please enter a valid email.");
    return;
  }
  if (pw.length < 8) {
    alert("Password must be at least 8 characters long.");
    return;
  }

  try {
    var res = await api.post("/admin-users", {
      firstName: fn,
      lastName: ln,
      email: em,
      role: role,
      password: pw,
    });
    if (res.success) {
      alert(res.message);
      closeAddUserModal();
      e.target.reset();
      await loadAdminUsers();
    }
  } catch (err) {
    alert(err.message || "Unable to create administrator account.");
  }
}
function exportPDF() {
  var users = getVisibleUsersForExport();
  if (!users.length) {
    showUserExportStatus("No visible users to export.");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showUserExportStatus("PDF library unavailable.");
    return;
  }
  var pdf = new window.jspdf.jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  var margin = 14,
    pw = pdf.internal.pageSize.getWidth(),
    ph = pdf.internal.pageSize.getHeight();
  var uw = pw - margin * 2,
    widths = [24, 38, 38, 65, 44, uw - 209];
  var headers = [
    "User ID",
    "First Name",
    "Last Name",
    "Email",
    "Role",
    "Status",
  ];
  var su =
    typeof api !== "undefined" && api.getStoredUser
      ? api.getStoredUser() || {}
      : {};
  var genBy =
    [su.first_name || su.firstName, su.last_name || su.lastName]
      .filter(Boolean)
      .join(" ") || "Administrator";
  var search =
    document.getElementById("searchInput") &&
    document.getElementById("searchInput").value.trim();
  var page = 1,
    y = 18;
  function footer() {
    pdf.setDrawColor(190);
    pdf.line(margin, ph - 12, pw - margin, ph - 12);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(
      "BSCCARS " +
        String.fromCharCode(8211) +
        " Confidential user management export",
      margin,
      ph - 7,
    );
    pdf.text("Page " + page, pw - margin, ph - 7, { align: "right" });
    pdf.setTextColor(0);
  }
  function thdr() {
    pdf.setFillColor(20, 82, 100);
    pdf.rect(margin, y, uw, 8, "F");
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    var x = margin;
    for (var h = 0; h < headers.length; h++) {
      pdf.text(headers[h], x + 2, y + 5.2);
      x += widths[h];
    }
    pdf.setTextColor(0);
    y += 8;
  }
  function np() {
    footer();
    pdf.addPage();
    page++;
    y = 18;
    pdf.setFontSize(11);
    pdf.text("User Management Export (continued)", margin, y);
    y += 7;
    thdr();
  }
  pdf.setFontSize(16);
  pdf.text("BSCCARS", margin, y);
  pdf.setFontSize(9);
  pdf.setTextColor(80);
  pdf.text(
    "Barangay Sillon Community Complaint and Response System",
    margin,
    y + 5,
  );
  pdf.setTextColor(0);
  y += 15;
  pdf.setFontSize(14);
  pdf.text("User Management Export", margin, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.text("Generated: " + new Date().toLocaleString(), margin, y);
  pdf.text("Generated by: " + genBy, margin, y + 5);
  pdf.text(
    "Visible users: " +
      users.length +
      (search ? " (search: " + search + ")" : ""),
    margin,
    y + 10,
  );
  y += 18;
  thdr();
  for (var i = 0; i < users.length; i++) {
    var vals = [
      users[i].id,
      users[i].firstName,
      users[i].lastName,
      users[i].email,
      users[i].role,
      users[i].status,
    ];
    pdf.setFontSize(8);
    var cells = vals.map(function (v, idx) {
      return pdf.splitTextToSize(
        v || String.fromCharCode(8212),
        widths[idx] - 4,
      );
    });
    var h = Math.max(
      7,
      Math.max.apply(
        null,
        cells.map(function (cl) {
          return cl.length * 4 + 3;
        }),
      ),
    );
    if (y + h > ph - 16) np();
    if (i % 2 === 1) {
      pdf.setFillColor(247, 250, 251);
      pdf.rect(margin, y, uw, h, "F");
    }
    var x = margin;
    for (var c = 0; c < cells.length; c++) {
      pdf.text(cells[c], x + 2, y + 4.5);
      x += widths[c];
    }
    pdf.setDrawColor(220);
    pdf.line(margin, y + h, pw - margin, y + h);
    y += h;
  }
  footer();
  pdf.save("users-export.pdf");
  showUserExportStatus("PDF export downloaded.");
}
function exportCSV() {
  var users = getVisibleUsersForExport();
  if (!users.length) {
    showUserExportStatus("No visible users to export.");
    return;
  }
  var headers = [
    "User ID",
    "First Name",
    "Last Name",
    "Middle Name",
    "Email",
    "Role",
    "Status",
  ];
  function q(v) {
    return '"' + String(v || "").replace(/"/g, '""') + '"';
  }
  var rows = [headers.join(",")].concat(
    users.map(function (u) {
      return [
        u.id,
        u.firstName,
        u.lastName,
        u.middleName,
        u.email,
        u.role,
        u.status,
      ]
        .map(q)
        .join(",");
    }),
  );
  var csv = rows.join("\r\n");
  var link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "users-export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(link.href);
  }, 0);
  showUserExportStatus("CSV export downloaded.");
}
function getVisibleUsersForExport() {
  return Array.from(document.querySelectorAll("#usersBody tr"))
    .filter(function (r) {
      return r.style.display !== "none" && r.cells.length >= 7;
    })
    .map(function (r) {
      return {
        id: r.cells[0].textContent.trim(),
        firstName: r.cells[1].textContent.trim(),
        lastName: r.cells[2].textContent.trim(),
        middleName: r.cells[3].textContent.trim(),
        email: r.cells[4].textContent.trim(),
        role: r.cells[5].textContent.trim(),
        status: r.cells[6].textContent.trim(),
      };
    });
}
function showUserExportStatus(msg) {
  var el = document.getElementById("userExportStatus");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(showUserExportStatus._t);
  showUserExportStatus._t = setTimeout(function () {
    el.textContent = "";
  }, 4000);
}
