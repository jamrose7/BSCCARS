document.addEventListener("DOMContentLoaded", () => {
  const signout = document.querySelector(".signout");

  if (!signout) {
    return;
  }

  signout.addEventListener("click", () => {
    const confirmSignout = confirm("Are you sure you want to sign out?");
    if (confirmSignout) {
      window.location.href = "index.html";
    }
  });
});