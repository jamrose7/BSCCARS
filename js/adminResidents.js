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

function approveResident(button) {
  const row = button.closest("tr");
  const residentName = row.querySelector("td").textContent;

  const confirm = window.confirm(`Approve ${residentName}'s account?`);

  if (confirm) {
    const actionCell = row.querySelector("td:last-child");
    actionCell.innerHTML = '<div class="status-approved">✓ Approved</div>';
    button.disabled = true;
  }
}

function rejectResident(button) {
  const row = button.closest("tr");
  const residentName = row.querySelector("td").textContent;

  const confirm = window.confirm(`Reject ${residentName}'s account?`);

  if (confirm) {
    const actionCell = row.querySelector("td:last-child");
    actionCell.innerHTML = '<div class="status-rejected">✗ Rejected</div>';
    button.disabled = true;
  }
}
