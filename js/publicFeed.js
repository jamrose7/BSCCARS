document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("feedContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const signoutBtn = document.querySelector(".signout");
  const detailModal = document.getElementById("detailModal");
  const detailCloseBtn = document.getElementById("detailCloseBtn");

  const sampleComplaints = [
    {
      title: "Loud music past midnight",
      category: "Public Disturbance",
      purok: "Purok Bilabid 1",
      date: "2026-01-19",
      time: "9:30 PM",
      status: "In Progress",
      details:
        "A resident reported a loud music disturbance after midnight. The sound carried to nearby houses and disrupted sleep. The complaint is under investigation.",
    },
    {
      title: "Vehicle blocking driveways",
      category: "Illegal Parking",
      purok: "Purok Aguma-a 2",
      date: "2026-01-07",
      time: "10:00 AM",
      status: "Resolved",
      details:
        "A parked truck was blocking the driveway of a residential home. Barangay officials moved the vehicle and reminded the driver about parking rules.",
    },
  ];

  function getStoredComplaints() {
    try {
      return JSON.parse(localStorage.getItem("bsccarsComplaints")) || [];
    } catch (error) {
      return [];
    }
  }

  const complaints = [
    ...getStoredComplaints().map((complaint) => ({
      title: complaint.title,
      category: complaint.category,
      purok: complaint.purok,
      date: complaint.date,
      time: complaint.time,
      status: complaint.status,
      details: complaint.details,
    })),
    ...sampleComplaints,
  ];

  function handleSignout() {
    const confirmSignout = confirm("Are you sure you want to sign out?");
    if (confirmSignout) {
      window.location.href = "index.html";
    }
  }

  function setDetailText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || "-";
    }
  }

  function openDetailModal(complaint) {
    setDetailText("detailTitle", complaint.title);
    setDetailText("detailCategory", complaint.category);
    setDetailText("detailPurok", complaint.purok);
    setDetailText("detailDate", complaint.date);
    setDetailText("detailTime", complaint.time);
    setDetailText("detailStatus", complaint.status);
    setDetailText("detailDetails", complaint.details);

    if (detailModal) {
      detailModal.classList.add("show");
    }
  }

  function closeDetailModal() {
    if (detailModal) {
      detailModal.classList.remove("show");
    }
  }

  function addDetailLine(card, label, value) {
    const paragraph = document.createElement("p");
    paragraph.textContent = `${label}: ${value || "-"}`;
    card.appendChild(paragraph);
  }

  function render(data) {
    container.innerHTML = "";

    if (!data.length) {
      const empty = document.createElement("p");
      empty.className = "empty-feed";
      empty.textContent = "No public complaints match the selected filters.";
      container.appendChild(empty);
      return;
    }

    data.forEach((complaint) => {
      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("h3");
      title.textContent = `Complaint Title: ${complaint.title}`;
      card.appendChild(title);

      addDetailLine(card, "Category", complaint.category);
      addDetailLine(card, "Purok", complaint.purok);
      addDetailLine(card, "Incident Date", complaint.date);
      addDetailLine(card, "Incident Time", complaint.time);
      addDetailLine(card, "Status", complaint.status);
      addDetailLine(card, "Submitted by", "Anonymous");

      const button = document.createElement("button");
      button.className = "view-btn";
      button.type = "button";
      button.textContent = "View Details";
      button.addEventListener("click", () => openDetailModal(complaint));
      card.appendChild(button);

      container.appendChild(card);
    });
  }

  function filterData() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = complaints.filter((complaint) => {
      return (
        complaint.title.toLowerCase().includes(search) &&
        (category === "" || complaint.category === category) &&
        (status === "" || complaint.status === status)
      );
    });

    render(filtered);
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", handleSignout);
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetailModal();
    }
  });

  render(complaints);
});