document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("feedContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const detailModal = document.getElementById("detailModal");
  const detailCloseBtn = document.getElementById("detailCloseBtn");
  let complaints = [];

  const sampleComplaints = [
    {
      id: "CMP-2026-0001",
      title: "Loud music past midnight",
      category: "Noise and Public Disturbance",
      purok: "Purok Sara-Sara 1",
      date: "2026-07-11",
      time: "4:30 PM",
      status: "In Progress",
      details:
        "A resident reported a loud music disturbance after midnight. The sound carried to nearby houses and disrupted sleep. The complaint is under investigation.",
    },
  ];

  function getStoredComplaints() {
    try {
      return JSON.parse(localStorage.getItem("bsccarsComplaints")) || [];
    } catch (error) {
      return [];
    }
  }

  function getFallbackComplaints() {
    return [
      ...getStoredComplaints().map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        purok: complaint.purok,
        date: complaint.date,
        time: complaint.time || complaint.incidentTime || "",
        status: complaint.status,
        details: complaint.details,
        submittedBy: "Anonymous",
      })),
      ...sampleComplaints.map((complaint) => ({
        ...complaint,
        submittedBy: "Anonymous",
      })),
    ];
  }

  async function loadComplaints() {
    try {
      if (typeof api === "undefined" || !api.getPublicComplaintFeed) {
        throw new Error("Public feed API unavailable.");
      }

      const response = await api.getPublicComplaintFeed();
      complaints = Array.isArray(response?.data) ? response.data : [];
      if (!complaints.length) {
        complaints = getFallbackComplaints();
      }
    } catch (error) {
      complaints = getFallbackComplaints();
    }

    render(complaints);
  }

  function setDetailText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || "-";
    }
  }

  function openDetailModal(complaint) {
    setDetailText("detailId", complaint.id);
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

  function categoryMatchesFilter(complaintCategory, selectedCategory) {
    if (!selectedCategory) return true;
    if (selectedCategory === "Other") {
      return (
        complaintCategory === "Other" || complaintCategory.startsWith("Other:")
      );
    }
    return complaintCategory === selectedCategory;
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
      title.textContent = complaint.id
        ? `${complaint.id} - ${complaint.title}`
        : `Complaint Title: ${complaint.title}`;
      card.appendChild(title);

      addDetailLine(card, "Category", complaint.category);
      addDetailLine(card, "Purok", complaint.purok);
      addDetailLine(card, "Incident Date", complaint.date);
      addDetailLine(card, "Incident Time", complaint.time);
      addDetailLine(card, "Status", complaint.status);
      addDetailLine(card, "Submitted by", complaint.submittedBy || "Anonymous");

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
        categoryMatchesFilter(complaint.category, category) &&
        (status === "" || complaint.status === status)
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetailModal();
    }
  });

  loadComplaints();
});
