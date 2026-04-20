document.addEventListener("DOMContentLoaded", () => {
  const logout = document.querySelector(".logout");

  if (!logout) {
    return;
  }

  logout.addEventListener("click", () => {
    const confirmLogout = confirm("Are you sure you want to logout?");
    if (confirmLogout) {
      window.location.href = "index.html";
    }
  });
});