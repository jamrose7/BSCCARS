/**
 * profileManager.js
 *
 * Attaches profile-dropdown behavior to the existing PNG button already in the HTML.
 * Never removes, replaces, or recreates header buttons.
 *
 * Architecture rule:
 *   HTML  → owns the button + image markup
 *   CSS   → owns all appearance
 *   JS    → owns toggle behavior + data loading only
 */

(function () {
  "use strict";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getUser() {
    if (typeof api !== "undefined" && api.getStoredUser)
      return api.getStoredUser();
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }

  function inferRole() {
    return window.location.pathname.toLowerCase().includes("admin")
      ? "super_admin"
      : "resident";
  }

  const ROLE_LABELS = {
    resident: "Resident",
    assistant_admin: "Assistant Admin",
    super_admin: "Super Admin",
  };

  function buildPanelHTML(user) {
    const role = user?.role || inferRole();
    const isAdmin = role !== "resident";
    const firstName =
      user?.first_name || user?.firstName || (isAdmin ? "Admin" : "Resident");
    const lastName = user?.last_name || user?.lastName || "User";
    const name = `${firstName} ${lastName}`.trim();
    const email = user?.email || "";
    const roleLabel = ROLE_LABELS[role] || "User";
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
    const avatarSrc = user?.profile_picture_url || "";

    const primaryLink = isAdmin ? "adminComplaints.html" : "myComplaints.html";
    const primaryText = isAdmin ? "Manage Complaints" : "My Complaints";
    const viewProfileLink = isAdmin ? "adminProfile.html" : "profile.html";
    const editProfileLink = isAdmin ? "adminProfileEdit.html" : "profile-edit.html";

    return `
      <div class="prof-panel__header">
        <div class="prof-panel__avatar" aria-hidden="true">
          ${
            avatarSrc
              ? `<img src="${escapeHtml(avatarSrc)}" alt="" class="prof-panel__avatar-img" />`
              : `<span class="prof-panel__initials">${escapeHtml(initials)}</span>`
          }
        </div>
        <div class="prof-panel__identity">
          <strong class="prof-panel__name">${escapeHtml(name)}</strong>
          <span  class="prof-panel__role">${escapeHtml(roleLabel)}</span>
          ${email ? `<span class="prof-panel__email">${escapeHtml(email)}</span>` : ""}
        </div>
      </div>
      <div class="prof-panel__divider"></div>
      <nav class="prof-panel__actions" aria-label="Profile actions">
        <a href="${viewProfileLink}" class="prof-panel__action"> 
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="lucide lucide-user-icon lucide-user">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/> <circle cx="12" cy="7" r="4"/></svg> View Profile</a>
        <a href="${editProfileLink}" class="prof-panel__action">
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="lucide lucide-user-pen-icon lucide-user-pen">
        <path d="M11.5 15H7a4 4 0 0 0-4 4v2"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>
        <circle cx="10" cy="7" r="4"/></svg> Edit Profile</a>
        <a href="${primaryLink}" class="prof-panel__action">
        <svg xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="lucide lucide-clipboard-list-icon lucide-clipboard-list"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/>
        <path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg> ${escapeHtml(primaryText)}</a>
      </nav>
      <div class="prof-panel__divider"></div>
      <button type="button" class="prof-panel__action prof-panel__signout" id="profSignOutBtn">
       <svg xmlns="http://www.w3.org/2000/svg" 
       width="24" 
       height="24" 
       viewBox="0 0 24 24" 
       fill="none" 
       stroke="currentColor" 
       stroke-width="2" 
       stroke-linecap="round" stroke-linejoin="round" 
       class="lucide lucide-log-out-icon lucide-log-out">
       <path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
       </svg>  Sign Out
      </button>`;
  }

  function handleSignOut() {
    if (!confirm("Are you sure you want to sign out?")) return;
    try {
      if (typeof api !== "undefined" && api.signOut) {
        api.signOut();
      } else {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
      }
    } catch {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
    window.location.href = "sign_in.html";
  }

  function init() {
    const btn = document.querySelector(
      '.top-right button[aria-label="User profile"]',
    );
    if (!btn) return;

    const topRight = btn.closest(".top-right");

    const panel = document.createElement("div");
    panel.className = "prof-panel";
    panel.id = "profilePanel";
    panel.setAttribute("aria-label", "Profile panel");
    panel.setAttribute("role", "dialog");
    btn.insertAdjacentElement("afterend", panel);

    async function loadAndRender() {
      let user = getUser();
      try {
        const res = await api.getProfile?.();
        if (res?.success && res.data) {
          user = res.data;
          api.setUser?.(user);
        }
      } catch {
        /* use localStorage user as fallback */
      }

      panel.innerHTML = buildPanelHTML(user);

      panel
        .querySelector("#profSignOutBtn")
        ?.addEventListener("click", handleSignOut);
    }

    loadAndRender();

    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const notifPanel = topRight.querySelector("#notifPanel.is-open");
      const notifBtn = topRight.querySelector(
        '.icon-badge[aria-label="Notifications"]',
      );
      if (notifPanel) {
        notifPanel.classList.remove("is-open");
        notifBtn?.setAttribute("aria-expanded", "false");
      }

      const isOpen = panel.classList.contains("is-open");
      panel.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
    });

    const sidebarSignout = document.querySelector(".signout");
    if (sidebarSignout) {
      sidebarSignout.addEventListener("click", handleSignOut);
      sidebarSignout.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSignOut();
        }
      });
    }

    /* Close when clicking outside the header */
    document.addEventListener("click", (e) => {
      if (!topRight.contains(e.target)) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
