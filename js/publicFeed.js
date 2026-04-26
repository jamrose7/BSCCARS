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
      purok: "Purok 3",
      date: "01-19-2026",
      time: "9:30 PM",
      status: "In Progress"
    },
    {
      title: "Vehicle blocking residential driveway",
      category: "Parking",
      purok: "Purok 5",
      date: "01-07-2026",
      time: "10:00 AM",
      status: "Resolved"
    }
  ];

  function render(data) {
    container.innerHTML = "";

    data.forEach(c => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h3>Complaint Title: ${c.title}</h3>
        <p>Category: ${c.category}</p>
        <p>Purok/Sitio: ${c.purok}</p>
        <p>Incident Date: ${c.date}</p>
        <p>Incident Time: ${c.time}</p>
        <p>Status: ${c.status}</p>
        <p>Submitted by: Anonymous</p>
        <button class="view-btn">View Details</button>
      `;

      container.appendChild(card);
    });
  }

  function filterData() {
    const search = searchInput.value.toLowerCase();
    const category = categoryFilter.value;
    const status = statusFilter.value;

    const filtered = complaints.filter(c => {
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

  render(complaints);
});