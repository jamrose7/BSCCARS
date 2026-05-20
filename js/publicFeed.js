document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("feedContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const signoutBtn = document.querySelector(".signout");

  function handleSignout() {
    const confirmSignout = confirm("Are you sure you want to sign out?");
    if (confirmSignout) {
      window.location.href = "index.html";
    }
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", handleSignout);
  }

  const complaints = [
    {
      title: "Loud music past midnight",
      category: "Public Disturbance",
      purok: "Purok Bilabid 1",
      date: "01-19-2026",
      time: "9:30 PM",
      status: "In Progress",
      details:
        "A resident reported a loud music disturbance after midnight. The sound carried to nearby houses and disrupted sleep. The complaint is under investigation.",
    },
    {
      title: "Vehicle blocking driveways",
      category: "Illegal Parking",
      purok: "Purok Aguma-a 2",
      date: "01-07-2026",
      time: "10:00 AM",
      status: "Resolved",
      details:
        "A parked truck was blocking the driveway of a residential home. Barangay officials moved the vehicle and reminded the driver about parking rules.",
    },
  ];

  const detailModal = document.getElementById("detailModal");
  const detailCloseBtn = document.getElementById("detailCloseBtn");

  function openDetailModal(complaint) {
    document.getElementById("detailTitle").textContent = complaint.title;
    document.getElementById("detailCategory").textContent = complaint.category;
    document.getElementById("detailPurok").textContent = complaint.purok;
    document.getElementById("detailDate").textContent = complaint.date;
    document.getElementById("detailTime").textContent = complaint.time;
    document.getElementById("detailStatus").textContent = complaint.status;
    document.getElementById("detailDetails").textContent = complaint.details;

    detailModal.classList.add("show");
  }

  function closeDetailModal() {
    if (detailModal) {
      detailModal.classList.remove("show");
    }
  }

  function render(data) {
    container.innerHTML = "";

    data.forEach((c, index) => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h3>Complaint Title: ${c.title}</h3>
        <p>Category: ${c.category}</p>
        <p>Purok: ${c.purok}</p>
        <p>Incident Date: ${c.date}</p>
        <p>Incident Time: ${c.time}</p>
        <p>Status: ${c.status}</p>
        <p>Submitted by: Anonymous</p>
        <button class="view-btn" data-index="${index}">View Details</button>
      `;

      container.appendChild(card);
    });

    container.querySelectorAll(".view-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const index = parseInt(button.dataset.index, 10);
        const complaint = data[index];
        if (complaint) {
          openDetailModal(complaint);
        }
      });
    });
  }

  function filterData() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = complaints.filter((c) => {
      return (
        c.title.toLowerCase().includes(search) &&
        (category === "" || c.category === category) &&
        (status === "" || c.status === status)
      );
    });

    render(filtered);
  }

  searchInput.addEventListener("input", filterData);
  categoryFilter.addEventListener("change", filterData);
  statusFilter.addEventListener("change", filterData);

  if (detailCloseBtn) {
    detailCloseBtn.addEventListener("click", closeDetailModal);
  }

  if (detailModal) {
    detailModal.addEventListener("click", (event) => {
      if (event.target === detailModal) {
        closeDetailModal();
      }
    });
  }

  render(complaints);
});