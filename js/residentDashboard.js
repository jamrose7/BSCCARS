document.addEventListener("DOMContentLoaded", () => {
  console.log("Dashboard loaded");

  const signout = document.querySelector(".signout");
  if (!signout) return;

  signout.addEventListener("click", async () => {
    const confirmSignout = confirm("Are you sure you want to sign out?");
    if (!confirmSignout) return;

    try {
      if (typeof api !== "undefined" && api.logout) {
        await api.logout();
      } else {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
    } catch (e) {
      console.warn("Logout failed, clearing local storage as fallback", e);
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }

    window.location.href = "sign_in.html";
  });
});