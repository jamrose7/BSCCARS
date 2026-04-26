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

function viewComplaint(complaintId) {
  const modal = document.getElementById("complaintModal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeComplaintModal() {
  const modal = document.getElementById("complaintModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function viewImage(filename) {
  alert(`Opening image: ${filename}\nImage viewer feature coming soon.`);
}

function playVideo(filename) {
  alert(`Playing video: ${filename}\nVideo player feature coming soon.`);
}

function removeEvidence(filename) {
  const confirm = window.confirm(
    `Are you sure you want to remove ${filename}?`,
  );
  if (confirm) {
    alert(`${filename} has been removed.`);
  }
}

function saveAction() {
  const adminResponse = document.getElementById("adminResponse").value;
  const status = document.getElementById("statusSelect").value;

  if (!adminResponse.trim()) {
    alert("Please enter an admin response.");
    return;
  }

  alert(`Action saved!\n\nResponse: ${adminResponse}\nNew Status: ${status}`);
  closeComplaintModal();
}
