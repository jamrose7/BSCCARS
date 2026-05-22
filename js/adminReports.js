document.addEventListener("DOMContentLoaded", () => {
  const signout = document.querySelector(".signout");

  if (signout) {
    signout.addEventListener("click", () => {
      const confirmed = confirm("Are you sure you want to sign out?");
      if (confirmed) {
        window.location.href = "sign_in.html";
      }
    });
  }
});

function createSummaryCard(title, value) {
  return `
    <div class="summary-card">
      <h4>${title}</h4>
      <p>${value}</p>
    </div>
  `;
}

const reportRenderers = {
  category:   renderCategoryReport,
  monthly:    renderMonthlyReport,
  resolution: renderResolutionReport,
  priority:   renderPriorityReport,
};

function generateReport(reportType) {
  const renderer = reportRenderers[reportType];
  if (!renderer) {
    console.warn("Unknown report type:", reportType);
    return;
  }
  renderer();
}

function renderCategoryReport() {
  const categories = [
    {
      name: "Money Debt",
      example: "Resident reports neighbor refusing to repay a ₱5,000 loan on Purok Aguma-a 1.",
      monthlyVolume: 34,
      avgResolution: "4.2 days",
      highPriority: "8% of category",
      priorityNote: "Most common complaint in Barangay Sillon — informal lending disputes.",
    },
    {
      name: "Public Disturbance",
      example: "Loud videoke past midnight on Purok Bilabid 1 disrupting nearby households.",
      monthlyVolume: 28,
      avgResolution: "3.5 days",
      highPriority: "14% of category",
      priorityNote: "Most active during holiday weekends and night hours.",
    },
    {
      name: "Waste Management",
      example: "Garbage dumping beside barangay canal at Purok Tulingan.",
      monthlyVolume: 22,
      avgResolution: "4.1 days",
      highPriority: "11% of category",
      priorityNote: "High volume during rainy season due to blocked drains.",
    },
    {
      name: "Road Issue",
      example: "Potholes and uneven road surface near Purok Mamsa.",
      monthlyVolume: 10,
      avgResolution: "6.8 days",
      highPriority: "18% of category",
      priorityNote: "Most complaints filed after heavy rainfall.",
    },
    {
      name: "Illegal Parking",
      example: "Vehicle blocking a residential driveway on Purok Aguma-a 2.",
      monthlyVolume: 16,
      avgResolution: "5.2 days",
      highPriority: "9% of category",
      priorityNote: "Frequently reported near markets and church events.",
    },
    {
      name: "Property Damage",
      example: "Neighbor's broken fence caused by passing vehicle on Purok Bolinao 2.",
      monthlyVolume: 9,
      avgResolution: "5.8 days",
      highPriority: "12% of category",
      priorityNote: "Often linked to disputes between neighbors.",
    },
    {
      name: "Animal Concerns",
      example: "Stray dogs causing safety concerns along Purok Sap-Sap 2.",
      monthlyVolume: 8,
      avgResolution: "7.4 days",
      highPriority: "23% of category",
      priorityNote: "High priority when children or school routes are involved.",
    },
    {
      name: "Sanitation",
      example: "Clogged drainage canal overflowing into the street on Purok Pugapo.",
      monthlyVolume: 12,
      avgResolution: "4.9 days",
      highPriority: "10% of category",
      priorityNote: "Peaks during rainy season — mosquito breeding risk.",
    },
    {
      name: "Other",
      example: "Suspicious loitering near homes reported by residents of Purok Katambak.",
      monthlyVolume: 5,
      avgResolution: "3.1 days",
      highPriority: "6% of category",
      priorityNote: "Catch-all — admin re-categorizes after review.",
    },
  ];

  const reportViewer = document.getElementById("reportViewer");
  reportViewer.innerHTML = `
    <div class="report-summary">
      ${createSummaryCard("Total categories", "9 active complaint categories")}
      ${createSummaryCard("Most reported", "Money Debt — 34 complaints/month")}
      ${createSummaryCard("Fastest resolution", "Public Disturbance — 3.5 days")}
      ${createSummaryCard("Priority hotspot", "Animal Concerns — 23% high priority")}
    </div>

    <div class="report-detail">
      <table class="detail-table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Example Complaint</th>
            <th scope="col">Monthly Volume</th>
            <th scope="col">Avg Resolution</th>
            <th scope="col">High Priority Rate</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map((c) => `
            <tr>
              <td>${c.name}</td>
              <td>${c.example}</td>
              <td>${c.monthlyVolume}</td>
              <td>${c.avgResolution}</td>
              <td>${c.highPriority}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="report-cta">
        <p>
          Money Debt is the most frequent category in Barangay Sillon, reflecting common
          informal lending disputes among neighbors. Animal Concerns and Road Issues show
          the highest urgency rates and require proactive barangay response.
        </p>
      </div>
    </div>
  `;
}

function renderMonthlyReport() {
  const months = [
    { label: "Jan", value: 18 },
    { label: "Feb", value: 21 },
    { label: "Mar", value: 24 },
    { label: "Apr", value: 29 },
    { label: "May", value: 33 },
    { label: "Jun", value: 27 },
  ];

  const maxVolume = Math.max(...months.map((m) => m.value));

  const reportViewer = document.getElementById("reportViewer");
  reportViewer.innerHTML = `
    <div class="report-summary">
      ${createSummaryCard("Peak month", "May — 33 complaints")}
      ${createSummaryCard("Lowest month", "Jan — 18 complaints")}
      ${createSummaryCard("Monthly average", "25 complaints")}
      ${createSummaryCard("Trend", "Volume rises steadily from January and peaks in May.")}
    </div>

    <div class="report-detail">
      <div class="bar-group">
        ${months.map((month) => {
          const width = ((month.value / maxVolume) * 100).toFixed(1);
          return `
            <div class="bar-row">
              <strong>${month.label}</strong>
              <div class="bar-line">
                <div class="bar-fill" style="width:${width}%"></div>
              </div>
              <span>${month.value}</span>
            </div>
          `;
        }).join("")}
      </div>
      <div class="report-cta">
        <p>
          Monthly volume shows a strong upward trend from January to May, with complaint
          activity concentrated in road and disturbance cases during major barangay events.
        </p>
      </div>
    </div>
  `;
}

function renderResolutionReport() {
  const resolutionCategories = [
    { label: "Other",             value: 3.1, color: "#3bc2a4" },
    { label: "Public Disturbance",value: 3.5, color: "#3bc2a4" },
    { label: "Waste Management",  value: 4.1, color: "#5eb6d6" },
    { label: "Sanitation",        value: 4.9, color: "#5eb6d6" },
    { label: "Illegal Parking",   value: 5.2, color: "#70a8df" },
    { label: "Property Damage",   value: 5.8, color: "#70a8df" },
    { label: "Road Issue",        value: 6.8, color: "#b575d6" },
    { label: "Animal Concerns",   value: 7.4, color: "#e37f77" },
  ];

  const maxDays = Math.max(...resolutionCategories.map((c) => c.value));

  const reportViewer = document.getElementById("reportViewer");
  reportViewer.innerHTML = `
    <div class="report-summary">
      ${createSummaryCard("Fastest resolution", "Other — 3.1 days")}
      ${createSummaryCard("Slowest resolution", "Animal Concerns — 7.4 days")}
      ${createSummaryCard("Average across categories", "4.9 days")}
      ${createSummaryCard("Note", "Money Debt excluded — resolution depends on mediation outcome.")}
    </div>

    <div class="report-detail">
      <div class="bar-group">
        ${resolutionCategories.map((item) => {
          const width = ((item.value / maxDays) * 100).toFixed(1);
          return `
            <div class="bar-row">
              <strong>${item.label}</strong>
              <div class="bar-line">
                <div class="bar-fill" style="width:${width}%; background:${item.color}"></div>
              </div>
              <span>${item.value} days</span>
            </div>
          `;
        }).join("")}
      </div>
      <div class="report-cta">
        <p>
          Animal Concerns and Road Issues take the longest to resolve due to coordination
          with external agencies. Public Disturbance complaints are resolved fastest through
          barangay patrol response.
        </p>
      </div>
    </div>
  `;
}

function renderPriorityReport() {
  const trends = [
    {
      title: "Animal Concerns",
      text: "23% of category complaints are high priority, especially when stray animals threaten children along school routes in Purok Sap-Sap and Katambak.",
    },
    {
      title: "Road Issue",
      text: "18% of road issues are flagged urgent due to damage after heavy rains and blocked access to emergency routes.",
    },
    {
      title: "Public Disturbance",
      text: "14% of disturbance cases receive urgent response, mainly during late-night gatherings and festival weekends.",
    },
    {
      title: "Money Debt",
      text: "8% are escalated to high priority when disputes involve threats, harassment, or amounts that risk community safety.",
    },
    {
      title: "Sanitation",
      text: "10% flagged urgent during rainy season when clogged drainage creates flooding and health risks for multiple puroks.",
    },
  ];

  const reportViewer = document.getElementById("reportViewer");
  reportViewer.innerHTML = `
    <div class="report-summary">
      ${createSummaryCard("Highest priority category", "Animal Concerns — 23%")}
      ${createSummaryCard("Urgent cases this month", "12 high-priority incidents")}
      ${createSummaryCard("Critical trend", "Nighttime disturbances and roadside hazards")}
      ${createSummaryCard("Action focus", "Deploy patrols and drainage crews ahead of storm forecasts.")}
    </div>

    <div class="report-detail">
      <div class="trend-list">
        ${trends.map((trend) => `
          <div class="trend-item">
            <h5>${trend.title}</h5>
            <p>${trend.text}</p>
          </div>
        `).join("")}
      </div>
      <div class="report-cta">
        <p>
          High priority trends point to animal safety, road hazards, and flooding during
          storm season as the key areas requiring proactive barangay coordination.
        </p>
      </div>
    </div>
  `;
}

function showExportStatus(message) {
  const status = document.getElementById("exportStatus");
  if (!status) return;
  status.textContent = message;
  setTimeout(() => { status.textContent = ""; }, 4000);
}

function exportPDF() {
  showExportStatus("PDF export coming soon — backend not yet connected.");
}

function exportCSV() {
  showExportStatus("CSV export coming soon — backend not yet connected.");
}