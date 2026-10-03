"use strict";

let activeReportType = null;
let activeReport = null;

document.addEventListener("DOMContentLoaded", () => {
  const signout = document.querySelector(".signout");
  if (signout) {
    signout.addEventListener("click", () => {
      if (confirm("Are you sure you want to sign out?")) {
        api.signOut();
        window.location.href = "index.html";
      }
    });
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createSummaryCard(title, value) {
  return `<div class="summary-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(value)}</p></div>`;
}

function reportTitle(type) {
  return {
    category: "Complaints by Category",
    monthly: "Monthly Volume",
    resolution: "Average Resolution Time",
    priority: "High Priority Trends",
    recurring: "Recurring Complaint Activity",
  }[type] || "Report";
}

const REPORT_ENDPOINTS = {
  category: "/reports/by-category",
  monthly: "/reports/monthly",
  resolution: "/reports/resolution",
  priority: "/reports/priority",
  recurring: "/reports/recurring",
};

async function generateReport(reportType) {
  if (!Object.hasOwn(REPORT_ENDPOINTS, reportType)) return;
  const viewer = document.getElementById("reportViewer");
  viewer.innerHTML = '<div class="report-empty-state"><h3>Loading live report data…</h3></div>';

  try {
    const response = await api.get(REPORT_ENDPOINTS[reportType]);
    const rawRows = Array.isArray(response.data) ? response.data : [];
    if (reportType === "category") {
      const complaintsResponse = await api.getComplaints();
      const complaints = Array.isArray(complaintsResponse?.data)
        ? complaintsResponse.data
        : [];
      const idsByCategory = new Map();
      complaints.forEach((complaint) => {
        const category = complaint.category || "Uncategorized";
        if (!idsByCategory.has(category)) idsByCategory.set(category, []);
        if (complaint.id) idsByCategory.get(category).push(String(complaint.id));
      });
      rawRows.forEach((row) => {
        row.complaintIds = (idsByCategory.get(row.category || "Uncategorized") || []).join(", ");
      });
    }
    activeReportType = reportType;
    activeReport = mapReport(reportType, rawRows);
    renderReport(activeReport);
  } catch (error) {
    console.error("Unable to load report data:", error);
    activeReportType = null;
    activeReport = null;
    viewer.innerHTML = '<div class="report-empty-state"><h3>Unable to load the report.</h3><p>Please refresh and try again.</p></div>';
    showExportStatus("Report data could not be loaded.");
  }
}

function mapReport(type, rawRows) {
  if (type === "category") {
    const rows = rawRows.map((r) => ({
      category: r.category,
      complaints: r.totalComplaints,
      highPriority: r.highPriority,
      highPriorityRate: r.highPriorityRate,
      complaintIds: r.complaintIds || r.complaint_ids || "No IDs available",
    }));
    const highestCount = rows.reduce(
      (highest, row) => Math.max(highest, row.complaints),
      0,
    );
    const mostReported = rows.filter((row) => row.complaints === highestCount);
    const mostReportedLabel = !mostReported.length
      ? "No complaints"
      : mostReported.length > 1
        ? `Tie (${highestCount} each): ${mostReported.map((row) => row.category).join(", ")}`
        : `${mostReported[0].category} — ${highestCount}`;
    return {
      type,
      rows,
      summary: [
        ["Active complaints", rows.reduce((sum, r) => sum + r.complaints, 0)],
        ["Categories reported", rows.length],
        ["Most reported", mostReportedLabel],
        ["High-priority complaints", rows.reduce((sum, r) => sum + r.highPriority, 0)],
      ],
    };
  }

  if (type === "monthly") {
    const rows = rawRows.map((r) => ({ month: r.month, complaints: r.totalComplaints }));
    const total = rows.reduce((sum, r) => sum + r.complaints, 0);
    const peak = [...rows].sort((a, b) => b.complaints - a.complaints)[0];
    return {
      type,
      rows,
      summary: [
        ["Active complaints", total],
        ["Months with reports", rows.length],
        ["Peak month", peak ? `${peak.month} — ${peak.complaints}` : "No dated complaints"],
        ["Monthly average", rows.length ? (total / rows.length).toFixed(1) : "0"],
      ],
    };
  }

  if (type === "resolution") {
    const rows = rawRows.map((r) => ({
      category: r.category,
      resolved: r.resolvedComplaints,
      days: r.avgResolutionDays ?? 0,
    }));
    return {
      type,
      rows,
      summary: [
        ["Resolved with dates", rows.reduce((sum, r) => sum + r.resolved, 0)],
        ["Categories resolved", rows.length],
        ["Fastest resolution", rows[0] ? `${rows[0].category} — ${rows[0].days.toFixed(1)} days` : "No resolution dates"],
        ["Slowest resolution", rows.at(-1) ? `${rows.at(-1).category} — ${rows.at(-1).days.toFixed(1)} days` : "No resolution dates"],
      ],
    };
  }

  if (type === "recurring") {
    const complainants = rawRows.filter((r) => r.personType === "Complainant");
    return {
      type,
      rows: rawRows,
      summary: [
        ["Recurring complainants", complainants.length],
        ["Recurring reported respondents", rawRows.length - complainants.length],
        ["Highest activity", rawRows[0] ? `${rawRows[0].name} - ${rawRows[0].count}` : "No recurring activity"],
      ],
    };
  }

  const rows = rawRows.map((r) => ({ category: r.category, highPriority: r.highPriority }));
  return {
    type,
    rows,
    summary: [
      ["High-priority complaints", rows.reduce((sum, r) => sum + r.highPriority, 0)],
      ["Categories affected", rows.length],
      ["Priority hotspot", rows[0] ? `${rows[0].category} — ${rows[0].highPriority}` : "No high-priority complaints"],
    ],
  };
}

function renderReport(report) {
  const viewer = document.getElementById("reportViewer");
  const summary = `<div class="report-summary">${report.summary.map(([title, value]) => createSummaryCard(title, value)).join("")}</div>`;
  let headers;
  let cells;
  if (report.type === "category") {
    headers = ["Category", "Complaints", "High Priority", "High Priority Rate", "Complaint IDs"];
    cells = (row) => [row.category, row.complaints, row.highPriority, `${row.highPriorityRate.toFixed(1)}%`, row.complaintIds];
  } else if (report.type === "monthly") {
    headers = ["Month", "Complaints"];
    cells = (row) => [row.month, row.complaints];
  } else if (report.type === "resolution") {
    headers = ["Category", "Resolved Complaints", "Average Resolution"];
    cells = (row) => [row.category, row.resolved, `${row.days.toFixed(1)} days`];
  } else if (report.type === "recurring") {
    headers = ["Person Type", "Name", "Complaint Count", "Latest Complaint Date", "Common Category", "Status Breakdown"];
    cells = (row) => [row.personType, row.name, row.count, row.latestDate, row.commonCategory, row.statusBreakdown];
  } else {
    headers = ["Category", "High-Priority Complaints"];
    cells = (row) => [row.category, row.highPriority];
  }
  const body = report.rows.length ? report.rows.map((row) => `<tr>${cells(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No matching complaint data is available.</td></tr>`;
  const note = report.type === "recurring"
    ? '<p class="report-note">Counts indicate complaint activity only and do not determine fault.</p>'
    : "";
  viewer.innerHTML = `${summary}<div class="report-detail"><h4>${escapeHtml(reportTitle(report.type))}</h4>${note}<div class="detail-table-scroll"><table class="detail-table${report.type === "category" ? " category-report-table" : ""}"><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}

function exportRows(report) {
  if (report.type === "category") return { headers: ["Category", "Complaints", "High Priority", "High Priority Rate", "Complaint IDs"], rows: report.rows.map((r) => [r.category, r.complaints, r.highPriority, `${r.highPriorityRate.toFixed(1)}%`, r.complaintIds]) };
  if (report.type === "monthly") return { headers: ["Month", "Complaints"], rows: report.rows.map((r) => [r.month, r.complaints]) };
  if (report.type === "resolution") return { headers: ["Category", "Resolved Complaints", "Average Resolution Days"], rows: report.rows.map((r) => [r.category, r.resolved, r.days.toFixed(1)]) };
  if (report.type === "recurring") return { headers: ["Person Type", "Name", "Complaint Count", "Latest Complaint Date", "Common Category", "Status Breakdown"], rows: report.rows.map((r) => [r.personType, r.name, r.count, r.latestDate, r.commonCategory, r.statusBreakdown]) };
  return { headers: ["Category", "High-Priority Complaints"], rows: report.rows.map((r) => [r.category, r.highPriority]) };
}

function download(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function logReportExport(format) {
  if (!activeReportType || typeof api === "undefined" || !api.logReportExport) {
    return;
  }

  api.logReportExport(activeReportType, format).catch((error) => {
    console.warn("Unable to log report export:", error);
  });
}

function requireActiveReport() {
  if (activeReport) return true;
  showExportStatus("Select a report first so the export uses live data.");
  return false;
}

function exportCSV() {
  if (!requireActiveReport()) return;
  const { headers, rows } = exportRows(activeReport);
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  download(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `${activeReportType}-report.csv`);
  logReportExport("CSV");
  showExportStatus("CSV export downloaded.");
}

function exportPDF() {
  if (!requireActiveReport()) return;
  if (!window.jspdf?.jsPDF) {
    showExportStatus("PDF library is unavailable. Check your connection and try again.");
    return;
  }
  const { headers, rows } = exportRows(activeReport);
  const landscape = ["category", "recurring"].includes(activeReportType);
  const pdf = new window.jspdf.jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const generatedAt = new Date().toLocaleString();
  const user = typeof api !== "undefined" ? api.getStoredUser?.() || {} : {};
  const generatedBy = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Administrator";
  const widths = activeReportType === "category"
    ? [58, 27, 28, 33, usableWidth - 146]
    : activeReportType === "recurring"
      ? [30, 40, 24, 32, 42, usableWidth - 168]
    : activeReportType === "resolution"
      ? [usableWidth * 0.48, usableWidth * 0.22, usableWidth * 0.30]
      : [usableWidth * 0.68, usableWidth * 0.32];
  let page = 1;
  let y = 18;

  const footer = () => {
    pdf.setDrawColor(190);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text("BSCCARS — Confidential administrative report", margin, pageHeight - 7);
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
      pdf.text(String(header), x + 2, y + 5.2, { maxWidth: widths[index] - 4 });
      x += widths[index];
    });
    pdf.setTextColor(0);
    y += 8;
  };
  const newPage = () => {
    footer();
    pdf.addPage();
    page += 1;
    y = 18;
    pdf.setFontSize(11);
    pdf.text(`${reportTitle(activeReportType)} (continued)`, margin, y);
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
  pdf.text(reportTitle(activeReportType), margin, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.text(`Generated: ${generatedAt}`, margin, y);
  pdf.text(`Generated by: ${generatedBy}`, margin, y + 5);
  y += 13;
  pdf.setFillColor(239, 246, 248);
  pdf.rect(margin, y, usableWidth, activeReport.summary.length * 5 + 5, "F");
  pdf.setFontSize(9);
  activeReport.summary.forEach(([label, value], index) => {
    pdf.text(`${label}: ${value}`, margin + 3, y + 5 + index * 5);
  });
  y += activeReport.summary.length * 5 + 11;

  if (activeReportType === "recurring") {
    pdf.setFontSize(8);
    pdf.setTextColor(80);
    pdf.text(
      "Counts indicate complaint activity only and do not determine fault.",
      margin,
      y
    );
    pdf.setTextColor(0);
    y += 7;
  }

  tableHeader();

  rows.forEach((row, rowIndex) => {
    pdf.setFontSize(8);
    const cells = row.map((cell, index) => pdf.splitTextToSize(String(cell ?? "—"), widths[index] - 4));
    const rowHeight = Math.max(7, ...cells.map((lines) => lines.length * 4 + 3));
    if (y + rowHeight > pageHeight - 16) newPage();
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(247, 250, 251);
      pdf.rect(margin, y, usableWidth, rowHeight, "F");
    }
    let x = margin;
    cells.forEach((lines, index) => {
      pdf.text(lines, x + 2, y + 4.5);
      x += widths[index];
    });
    pdf.setDrawColor(220);
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  });
  footer();
  pdf.save(`${activeReportType}-report.pdf`);
  logReportExport("PDF");
  showExportStatus("PDF export downloaded.");
}

function showExportStatus(message) {
  const status = document.getElementById("exportStatus");
  if (!status) return;
  status.textContent = message;
  clearTimeout(showExportStatus.timeout);
  showExportStatus.timeout = setTimeout(() => { status.textContent = ""; }, 4000);
}
