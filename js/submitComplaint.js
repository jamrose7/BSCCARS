document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("complaintForm");
  const modal = document.getElementById("successModal");
  const refId = document.getElementById("refId");
  const summaryBlock = document.getElementById("summaryBlock");
  const viewBtn = document.getElementById("viewComplaintsBtn");
  const dashboardBtn = document.getElementById("goDashboardBtn");
  const closeModal = document.getElementById("closeModal");
  const logoutBtn = document.querySelector(".logout");

  function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      window.location.href = "index.html";
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const category = document.getElementById("category").value;
    const details = document.getElementById("details").value.trim();
    const purok = document.getElementById("purok").value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const priority = document.querySelector(
      "input[name='priority']:checked",
    ).value;
    const anonymous = document.getElementById("anonymous").checked;

    if (!title || !details) {
      alert("Please fill in the complaint title and details.");
      return;
    }

    if ((date && !time) || (!date && time)) {
      alert("Please provide both incident date and time, or leave both empty.");
      return;
    }

    const id = "#C-2026-" + Math.floor(100 + Math.random() * 900);
    refId.textContent = id;

    summaryBlock.innerHTML = `
      <p><strong>Category:</strong> ${category}</p>
      <p><strong>Purok/Sitio:</strong> ${purok}</p>
      <p><strong>Priority:</strong> ${priority === "high" ? "High Priority" : "Normal"}</p>
      <p><strong>Incident:</strong> ${date ? `${date}${time ? " at " + time : ""}` : "Not specified"}</p>
      <p><strong>Hidden identity:</strong> ${anonymous ? "Yes" : "No"}</p>
    `;
    summaryBlock.hidden = false;

    modal.style.display = "flex";
  });

  viewBtn.addEventListener("click", () => {
    window.location.href = "myComplaints.html";
  });

  dashboardBtn.addEventListener("click", () => {
    window.location.href = "residentDashboard.html";
  });

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});
