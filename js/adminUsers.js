/**
 * Administrator account lifecycle is create -> activate -> deactivate
 * (see README.md "Administrator Onboarding and Turnover"). There is no
 * archive step for admin accounts: unlike complaints and residents, an
 * admin account's activity-log history must stay attributable to a real,
 * queryable account record, so Deactivate is the terminal lifecycle
 * action here. Activate/Deactivate are backend-backed and gate sign-in
 * eligibility directly.
 */
document.addEventListener("DOMContentLoaded", function () {
  initActivityDateRange();
  loadActivityLogs();
  loadAdminUsers();
});

var activityPage = 1;
var activityDateRange = "today";

function deactSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
}

function getCurrentAdminId() {
  try {
    return (JSON.parse(localStorage.getItem("user")) || {}).id || "";
  } catch (e) {
    return "";
  }
}

function getCurrentAdminName() {
  try {
    var u = JSON.parse(localStorage.getItem("user")) || {};
    return u.first_name && u.last_name
      ? u.first_name + " " + u.last_name
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
    h += '<span class="status-badge status-inactive status-awaiting">Awaiting email activation</span>';
  }
  if (active) {
    h +=
      '<button class="action-btn status-deactivate" onclick="handleDeactivate(\'' +
      user.id +
      '\')" title="Deactivate">' +
      deactSvg() +
      "</button>";
  }
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
async function loadActivityLogs() {
  if (typeof api === "undefined" || !api.getSystemActivityLogs) {
    renderActivityLogRows([]);
    return;
  }
  try {
    var filters = getActivityFilters();
    var res = await api.getSystemActivityLogs(filters);
    var backend = Array.isArray(res && res.data) ? res.data : [];
    renderActivityLogRows(backend.map(normalizeBackendLog));
    renderActivityPagination(res.pagination || { page: 1, pageSize: 20, total: backend.length, totalPages: 1 });
    populateActivityOptions(res.activities || []);
  } catch (e) {
    renderActivityLogRows([]);
  }
}
function padDatePart(value) {
  return String(value).padStart(2, "0");
}
function formatDateInputValue(date) {
  return (
    date.getFullYear() +
    "-" +
    padDatePart(date.getMonth() + 1) +
    "-" +
    padDatePart(date.getDate())
  );
}
function getActivityPresetRange(range) {
  var today = new Date();
  var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var end = new Date(start);

  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end = new Date(start);
  } else if (range === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (range === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  return {
    from: formatDateInputValue(start),
    to: formatDateInputValue(end),
  };
}
function setActiveActivityDatePreset(range) {
  activityDateRange = range;
  document.querySelectorAll(".activity-date-preset").forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.range === range);
  });
  var customRange = document.getElementById("activityCustomRange");
  if (customRange) customRange.hidden = range !== "custom";
}
function initActivityDateRange() {
  var buttons = document.querySelectorAll(".activity-date-preset");
  if (!buttons.length) return;
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      setActiveActivityDatePreset(button.dataset.range || "today");
      activityPage = 1;
      loadActivityLogs();
    });
  });
  ["activityFrom", "activityTo"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) {
      input.addEventListener("change", function () {
        if (activityDateRange === "custom") {
          activityPage = 1;
          loadActivityLogs();
        }
      });
    }
  });
  var sort = document.getElementById("activitySort");
  if (sort) {
    sort.addEventListener("change", function () {
      activityPage = 1;
      loadActivityLogs();
    });
  }
  setActiveActivityDatePreset(activityDateRange);
}
function getActivityFilters() {
  var dateRange =
    activityDateRange === "custom"
      ? {
          from: (document.getElementById("activityFrom") || {}).value || "",
          to: (document.getElementById("activityTo") || {}).value || "",
        }
      : getActivityPresetRange(activityDateRange);
  return {
    page: activityPage,
    pageSize: 20,
    search: (document.getElementById("activitySearch") || {}).value || "",
    from: dateRange.from,
    to: dateRange.to,
    activity: (document.getElementById("activityFilter") || {}).value || "",
    sort: (document.getElementById("activitySort") || {}).value || "latest",
  };
}
function applyActivityFilters() {
  activityPage = 1;
  loadActivityLogs();
}
function clearActivityFilters() {
  ["activitySearch", "activityFrom", "activityTo"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  setActiveActivityDatePreset("today");
  var act = document.getElementById("activityFilter");
  var sort = document.getElementById("activitySort");
  if (act) act.value = "";
  if (sort) sort.value = "latest";
  applyActivityFilters();
}
function populateActivityOptions(items) {
  var select = document.getElementById("activityFilter");
  if (!select || select.options.length > 1) return;
  items.forEach(function (item) {
    var option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}
function renderActivityPagination(p) {
  var summary = document.getElementById("activityPaginationSummary");
  var controls = document.getElementById("activityPaginationControls");
  if (!summary || !controls) return;
  var start = p.total ? (p.page - 1) * p.pageSize + 1 : 0;
  var end = Math.min(p.page * p.pageSize, p.total || 0);
  summary.textContent = "Showing " + start + "-" + end + " of " + (p.total || 0) + " activities";
  var html = '<button type="button" ' + (p.page <= 1 ? "disabled" : "") + ' onclick="gotoActivityPage(' + (p.page - 1) + ')">Previous</button>';
  for (var i = 1; i <= p.totalPages; i++) {
    if (i === 1 || i === p.totalPages || Math.abs(i - p.page) <= 2) {
      html += '<button type="button" ' + (i === p.page ? "disabled" : "") + ' onclick="gotoActivityPage(' + i + ')">' + i + "</button>";
    }
  }
  html += '<button type="button" ' + (p.page >= p.totalPages ? "disabled" : "") + ' onclick="gotoActivityPage(' + (p.page + 1) + ')">Next</button>';
  controls.innerHTML = html;
}
function gotoActivityPage(page) {
  activityPage = page;
  loadActivityLogs();
}
function normalizeBackendLog(log) {
  var ts = new Date(log.timestamp || Date.now());
  var targetLabels = {
    account: "Account",
    resident: "Resident",
    complaint: "Complaint",
    hearing_notice: "Hearing notice",
    notification: "Notification",
    report: "Report",
  };
  var targetType = String(log.targetType || "").replace(/_/g, " ");
  var targetLabel = targetLabels[log.targetType] ||
    targetType.replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  var targetId = log.targetId;
  if (log.targetType === "notification" && /^Read notification: /.test(log.action || "")) {
    targetId = String(log.action).slice("Read notification: ".length);
  }
  return {
    action: log.action || "",
    by: log.user || "System",
    target:
      [targetLabel, targetId].filter(Boolean).join(": ") ||
      log.details ||
      "No specific target",
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

  if (!fn || !ln || !em) {
    alert("Please fill in all fields.");
    return;
  }
  if (typeof Validators !== "undefined" && !Validators.email(em)) {
    alert("Please enter a valid email.");
    return;
  }
  try {
    var res = await api.post("/admin-users", {
      firstName: fn,
      lastName: ln,
      email: em,
      role: role
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
    [su.first_name, su.last_name]
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
      users[i].first_name,
      users[i].last_name,
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
        u.first_name,
        u.last_name,
        u.middle_name,
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
        first_name: r.cells[1].textContent.trim(),
        last_name: r.cells[2].textContent.trim(),
        middle_name: r.cells[3].textContent.trim(),
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
