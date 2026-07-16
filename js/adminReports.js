"use strict";

let activeReportType = null;
let activeReport = null;

document.addEventListener("DOMContentLoaded", () => {
  const signout = document.querySelector(".signout");
  if (signout) {
    signout.addEventListener("click", () => {
      if (confirm("Are you sure you want to sign out?")) {
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

function dateValue(complaint) {
  const value = complaint.createdAt || complaint.created_at || complaint.submittedAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolutionDays(complaint) {
  const created = dateValue(complaint);
  const resolved = new Date(complaint.resolvedAt || complaint.resolved_at || complaint.closedAt);
  if (!created || Number.isNaN(resolved.getTime())) return null;
  return (resolved - created) / 86400000;
}

function isHighPriority(complaint) {
  return ["high", "urgent", "critical"].includes(String(complaint.priority || "").toLowerCase());
}

function reportTitle(type) {
  return {
    category: "Complaints by Category",
    monthly: "Monthly Volume",
    resolution: "Average Resolution Time",
    priority: "High Priority Trends",
  }[type] || "Report";
}

async function generateReport(reportType) {
  if (!Object.hasOwn(reportRenderers, reportType)) return;
  const viewer = document.getElementById("reportViewer");
  viewer.innerHTML = '<div class="report-empty-state"><h3>Loading live complaint data…</h3></div>';

  try {
    // This is deliberately the same endpoint used by Admin Complaints, so report
    // totals and complaint IDs always describe the same active records.
    const response = await api.getComplaints();
    const complaints = Array.isArray(response.data) ? response.data : [];
    activeReportType = reportType;
    activeReport = buildReport(reportType, complaints);
    renderReport(activeReport);
  } catch (error) {
    console.error("Unable to load report data:", error);
    activeReportType = null;
    activeReport = null;
    viewer.innerHTML = '<div class="report-empty-state"><h3>Unable to load the report.</h3><p>Please refresh and try again.</p></div>';
    showExportStatus("Report data could not be loaded.");
  }
}

const reportRenderers = {
  category: true,
  monthly: true,
  resolution: true,
  priority: true,
};

function buildReport(type, complaints) {
  if (type === "category") {
    const groups = new Map();
    complaints.forEach((complaint) => {
      const category = complaint.category || "Uncategorized";
      const group = groups.get(category) || { category, total: 0, high: 0, examples: [] };
      group.total += 1;
      group.high += Number(isHighPriority(complaint));
      if (complaint.id) group.examples.push(complaint.id);
      groups.set(category, group);
    });
    const rows = [...groups.values()].map((group) => ({
      category: group.category,
      complaints: group.total,
      highPriority: group.high,
      highPriorityRate: group.total ? (group.high / group.total) * 100 : 0,
      complaintIds: group.examples.join(", ") || "—",
    })).sort((a, b) => b.complaints - a.complaints || a.category.localeCompare(b.category));
    return { type, rows, summary: [
      ["Active complaints", complaints.length],
      ["Categories reported", rows.length],
      ["Most reported", rows[0] ? `${rows[0].category} — ${rows[0].complaints}` : "No complaints"],
      ["High-priority complaints", complaints.filter(isHighPriority).length],
    ] };
  }

  if (type === "monthly") {
    const groups = new Map();
    complaints.forEach((complaint) => {
      const date = dateValue(complaint);
      if (!date) return;
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      groups.set(month, (groups.get(month) || 0) + 1);
    });
    const rows = [...groups.entries()].map(([month, complaints]) => ({ month, complaints })).sort((a, b) => a.month.localeCompare(b.month));
    const peak = [...rows].sort((a, b) => b.complaints - a.complaints)[0];
    return { type, rows, summary: [
      ["Active complaints", complaints.length],
      ["Months with reports", rows.length],
      ["Peak month", peak ? `${peak.month} — ${peak.complaints}` : "No dated complaints"],
      ["Monthly average", rows.length ? (complaints.length / rows.length).toFixed(1) : "0"],
    ] };
  }

  if (type === "resolution") {
    const groups = new Map();
    complaints.forEach((complaint) => {
      const days = resolutionDays(complaint);
      if (days === null) return;
      const category = complaint.category || "Uncategorized";
      const group = groups.get(category) || { category, count: 0, totalDays: 0 };
      group.count += 1;
      group.totalDays += days;
      groups.set(category, group);
    });
    const rows = [...groups.values()].map((group) => ({ category: group.category, resolved: group.count, days: group.totalDays / group.count })).sort((a, b) => a.days - b.days);
    return { type, rows, summary: [
      ["Resolved with dates", rows.reduce((sum, row) => sum + row.resolved, 0)],
      ["Categories resolved", rows.length],
      ["Fastest resolution", rows[0] ? `${rows[0].category} — ${rows[0].days.toFixed(1)} days` : "No resolution dates"],
      ["Slowest resolution", rows.at(-1) ? `${rows.at(-1).category} — ${rows.at(-1).days.toFixed(1)} days` : "No resolution dates"],
    ] };
  }

  const groups = new Map();
  complaints.filter(isHighPriority).forEach((complaint) => {
    const category = complaint.category || "Uncategorized";
    groups.set(category, (groups.get(category) || 0) + 1);
  });
  const rows = [...groups.entries()].map(([category, highPriority]) => ({ category, highPriority })).sort((a, b) => b.highPriority - a.highPriority || a.category.localeCompare(b.category));
  return { type, rows, summary: [
    ["Active complaints", complaints.length],
    ["High-priority complaints", complaints.filter(isHighPriority).length],
    ["Categories affected", rows.length],
    ["Priority hotspot", rows[0] ? `${rows[0].category} — ${rows[0].highPriority}` : "No high-priority complaints"],
  ] };
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
  } else {
    headers = ["Category", "High-Priority Complaints"];
    cells = (row) => [row.category, row.highPriority];
  }
  const body = report.rows.length ? report.rows.map((row) => `<tr>${cells(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No matching complaint data is available.</td></tr>`;
  viewer.innerHTML = `${summary}<div class="report-detail"><h4>${escapeHtml(reportTitle(report.type))}</h4><table class="detail-table"><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function exportRows(report) {
  if (report.type === "category") return { headers: ["Category", "Complaints", "High Priority", "High Priority Rate", "Complaint IDs"], rows: report.rows.map((r) => [r.category, r.complaints, r.highPriority, `${r.highPriorityRate.toFixed(1)}%`, r.complaintIds]) };
  if (report.type === "monthly") return { headers: ["Month", "Complaints"], rows: report.rows.map((r) => [r.month, r.complaints]) };
  if (report.type === "resolution") return { headers: ["Category", "Resolved Complaints", "Average Resolution Days"], rows: report.rows.map((r) => [r.category, r.resolved, r.days.toFixed(1)]) };
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
  showExportStatus("CSV export downloaded.");
}

function exportPDF() {
  if (!requireActiveReport()) return;
  if (!window.jspdf?.jsPDF) {
    showExportStatus("PDF library is unavailable. Check your connection and try again.");
    return;
  }
  const { headers, rows } = exportRows(activeReport);
  const landscape = activeReportType === "category";
  const pdf = new window.jspdf.jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const generatedAt = new Date().toLocaleString();
  const user = typeof api !== "undefined" ? api.getStoredUser?.() || {} : {};
  const generatedBy = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(" ") || "Administrator";
  const widths = activeReportType === "category"
    ? [58, 27, 28, 33, usableWidth - 146]
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
  showExportStatus("PDF export downloaded.");
}

function showExportStatus(message) {
  const status = document.getElementById("exportStatus");
  if (!status) return;
  status.textContent = message;
  clearTimeout(showExportStatus.timeout);
  showExportStatus.timeout = setTimeout(() => { status.textContent = ""; }, 4000);
}
