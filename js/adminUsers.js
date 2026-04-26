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

function searchUsers() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const table = document.getElementById("usersBody");
  const rows = table.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName("td");
    let found = false;

    for (let j = 0; j < cells.length; j++) {
      const cellText = cells[j].textContent.toLowerCase();
      if (cellText.includes(searchTerm)) {
        found = true;
        break;
      }
    }

    rows[i].style.display = found ? "" : "none";
  }
}

function viewUser(userId) {
  alert(
    `Viewing user ${userId} details.\nUser detail view feature coming soon.`,
  );
}

function editUser(userId) {
  alert(`Editing user ${userId}.\nUser edit feature coming soon.`);
}

function deleteUser(userId) {
  const confirmDelete = confirm(
    `Are you sure you want to delete user ${userId}?`,
  );
  if (confirmDelete) {
    alert(`User ${userId} has been deleted.`);
  }
}

function openAddUserModal() {
  const modal = document.getElementById("addUserModal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeAddUserModal() {
  const modal = document.getElementById("addUserModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function saveNewUser(event) {
  event.preventDefault();

  const name = document.getElementById("newUserName").value;
  const email = document.getElementById("newUserEmail").value;
  const role = document.getElementById("newUserRole").value;

  if (!name || !email || !role) {
    alert("Please fill in all fields.");
    return;
  }

  alert(`New user "${name}" has been added successfully!`);
  closeAddUserModal();

  // Reset form
  document.getElementById("newUserName").value = "";
  document.getElementById("newUserEmail").value = "";
  document.getElementById("newUserRole").value = "";
}

function exportPDF() {
  alert("Exporting users list as PDF...\nPDF export feature coming soon.");
}

function exportCSV() {
  alert("Exporting users list as CSV...\nCSV export feature coming soon.");
}
