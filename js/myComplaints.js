document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("complaintsBody");
  const signoutBtn = document.querySelector(".signout");

  function handleSignout() {
    const confirmSignout = confirm("Are you sure you want to sign out?");
    if (confirmSignout) {
      sessionStorage.removeItem("residentSignedIn");
      window.location.href = "index.html";
    }
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", handleSignout);
  }

  const complaints = [
    {
      title: "Loud music past midnight",
      category: "Noise",
      priority: "High",
      status: "In Progress",
      date: "2026-01-19",
      time: "9:30 PM",
    },
    {
      title: "Illegal dumping near canal",
      category: "Waste",
      priority: "Normal",
      status: "Resolved",
      date: "2026-01-08",
      time: "3:10 PM",
    },
    {
      title: "Vehicles blocking driveways",
      category: "Parking",
      priority: "Normal",
      status: "Pending",
      date: "2026-01-07",
      time: "10:00 AM",
    },
  ];

  complaints.forEach((c) => {
    const statusClass = c.status.toLowerCase().replace(/\s+/g, "-");
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${c.title}</td>
      <td>${c.category}</td>
      <td>${c.priority}</td>
      <td><span class="status-pill ${statusClass}">${c.status}</span></td>
      <td>${c.date}</td>
      <td>${c.time}</td>
      <td><button class="view-btn" aria-label="View complaint">▶</button></td>
    `;

    tableBody.appendChild(row);
  });
});
