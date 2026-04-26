document.addEventListener("DOMContentLoaded", () => {
  const signout = document.querySelector(".signout");

  if (signout) {
    signout.addEventListener("click", () => {
      const confirmSignout = confirm("Are you sure you want to sign out?");
      if (confirmSignout) {
        window.location.href = "index.html";
      }
    });
  }
});

function generateReport(reportType) {
  const reportNames = {
    category: "Complaints by Category",
    monthly: "Monthly Volume",
    resolution: "Average Resolution Time",
    priority: "High Priority Trends",
  };

  const reportName = reportNames[reportType];
  alert(
    `Generating ${reportName} report...\nReport generation feature coming soon.`,
  );
}

function exportPDF() {
  alert("Exporting report as PDF...\nPDF export feature coming soon.");
}

function exportCSV() {
  alert("Exporting report as CSV...\nCSV export feature coming soon.");
}
