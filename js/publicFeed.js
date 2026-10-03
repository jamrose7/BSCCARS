document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("feedContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");
  let complaints = [];
  let feedLoadError = "";

  async function loadComplaints() {
    feedLoadError = "";

    try {
      if (typeof api === "undefined" || !api.getPublicComplaintFeed) {
        throw new Error("Public feed API unavailable.");
      }

      const response = await api.getPublicComplaintFeed();
      complaints = Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      complaints = [];
      feedLoadError =
        error?.message ||
        "Unable to load the public feed right now. Please try again.";
    }

    render(complaints);
  }

  function normalizeStatus(status) {
    const key = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-");

    if (["resolved", "closed", "completed"].includes(key)) return "Resolved";
    if (["in-progress", "progress", "ongoing"].includes(key)) {
      return "In Progress";
    }
    return key ? "Pending" : "Pending";
  }

  function statusClass(status) {
    return {
      Pending: "status-pending",
      "In Progress": "status-progress",
      Resolved: "status-resolved",
    }[normalizeStatus(status)];
  }

  function getComplaintDateValue(complaint) {
    const raw =
      complaint.createdAt ||
      complaint.created_at ||
      complaint.submittedAt ||
      complaint.submitted_at ||
      complaint.date ||
      complaint.incidentDate ||
      "";

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function createLabel(text, className) {
    const label = document.createElement("span");
    label.className = `feed-label ${className}`;
    label.textContent = text || "-";
    return label;
  }

  function addDetailLine(container, label, value) {
    const item = document.createElement("div");
    item.className = "detail-item";

    const labelElement = document.createElement("span");
    labelElement.className = "feed-detail-label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = "feed-detail-value";
    valueElement.textContent = value || "-";

    item.append(labelElement, valueElement);
    container.appendChild(item);
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

    if (feedLoadError) {
      const errorMsg = document.createElement("p");
      errorMsg.className = "empty-feed";
      errorMsg.textContent = feedLoadError;
      container.appendChild(errorMsg);
      return;
    }

    const sorted = [...data].sort(
      (a, b) => getComplaintDateValue(b) - getComplaintDateValue(a)
    );

    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className = "empty-feed";
      empty.textContent = complaints.length
        ? "No public complaints match the selected filters."
        : "No public complaints have been posted yet.";
      container.appendChild(empty);
      return;
    }

    sorted.forEach((complaint) => {
      const card = document.createElement("article");
      card.className = "card";

      const header = document.createElement("div");
      header.className = "card-header";

      const kicker = document.createElement("span");
      kicker.className = "card-kicker";
      kicker.textContent = complaint.id || "Public complaint";

      const titleRow = document.createElement("div");
      titleRow.className = "card-title-row";

      const title = document.createElement("h3");
      title.textContent = complaint.title || "Untitled complaint";
      titleRow.appendChild(title);

      const labels = document.createElement("div");
      labels.className = "label-row";
      labels.append(
        createLabel(complaint.category || "Uncategorized", "category-label"),
        createLabel(
          normalizeStatus(complaint.status),
          `status-label ${statusClass(complaint.status)}`
        )
      );

      header.append(kicker, titleRow, labels);

      const details = document.createElement("div");
      details.className = "card-details";
      addDetailLine(details, "Purok", complaint.purok);
      addDetailLine(
        details,
        "Incident Date",
        formatDate(complaint.date || complaint.incidentDate)
      );
      addDetailLine(
        details,
        "Incident Time",
        complaint.time || complaint.incidentTime
      );
      addDetailLine(details, "Submitted by", complaint.submittedBy || "Confidential");

      card.append(header, details);

      container.appendChild(card);
    });
  }

  function filterData() {
    const search = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = complaints.filter((complaint) => {
      const searchable = [
        complaint.id,
        complaint.title,
        complaint.category,
        complaint.purok,
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(search) &&
        categoryMatchesFilter(complaint.category || "", category) &&
        (status === "" || normalizeStatus(complaint.status) === status)
      );
    });

    render(filtered);
  }

  function resetFilters() {
    searchInput.value = "";
    categoryFilter.value = "";
    statusFilter.value = "";
    filterData();
  }

  searchInput.addEventListener("input", filterData);
  categoryFilter.addEventListener("change", filterData);
  statusFilter.addEventListener("change", filterData);
  resetFiltersBtn?.addEventListener("click", resetFilters);

  loadComplaints();
});
