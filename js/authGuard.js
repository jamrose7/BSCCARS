"use strict";

(function () {
  const adminPages = [
    "adminDashboard.html",
    "adminComplaints.html",
    "adminResidents.html",
    "adminReports.html",
    "adminUsers.html",
    "adminComplaintNotice.html",
    "adminProfile.html",
    "adminProfileEdit.html"
  ];

  const residentPages = [
    "residentDashboard.html",
    "myComplaints.html",
    "profile.html",
    "profile-edit.html",
    "publicFeed.html",
    "submitComplaint.html",
  ];

  const adminRoles = ["super_admin", "assistant_admin"];
  const validRoles = [...adminRoles, "resident"];

  function isAdminRoute() {
    const currentPage = window.location.pathname.split("/").pop();

    return adminPages.includes(currentPage);
  }

  function isResidentRoute() {
    const currentPage = window.location.pathname.split("/").pop();

    return residentPages.includes(currentPage);
  }

  function isAuthRequiredPage() {
    const path = window.location.pathname.toLowerCase();
    const unauthenticatedPages = [
      "index.html",
      "sign_in.html",
      "register.html",
      "forgot_password.html",
      "terms.html",
      "privacy.html",
      "disclaimer.html",
    ];

    return !unauthenticatedPages.some((page) => path.endsWith(page));
  }

  function redirectToSignIn() {
    window.location.href = "sign_in.html";
  }

  function redirectToResident() {
    window.location.href = "residentDashboard.html";
  }

  function redirectToAdmin() {
    window.location.href = "adminDashboard.html";
  }

 document.addEventListener("DOMContentLoaded", () => {
    const token = api.getToken();
    const user = api.getStoredUser();

    if (isAuthRequiredPage() && !token) {
        return redirectToSignIn();
    }

    if (!user || !user.role) {
        if (isAuthRequiredPage()) {
            return redirectToSignIn();
        }
        return;
    }

    if (!validRoles.includes(user.role)) {
        api.clearToken();
        return redirectToSignIn();
    }

    if (isAdminRoute() && !adminRoles.includes(user.role)) {
        return redirectToResident();
    }

    if (isResidentRoute() && adminRoles.includes(user.role)) {
        return redirectToAdmin();
    }
});

})();
