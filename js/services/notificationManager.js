/**
 * notificationManager.js
 *
 * Attaches notification behavior to the existing PNG button already in the HTML.
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

  function getStoredList(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  const localNotificationKey = "bsccarsLocalNotifications";

  function getLocalNotifications(role) {
    return getStoredList(localNotificationKey).filter((notification) => {
      const roles = Array.isArray(notification.roles) ? notification.roles : [];
      return !roles.length || roles.includes(role);
    });
  }

  function addLocalNotification({
    title,
    message,
    roles = ["assistant_admin", "super_admin"],
  } = {}) {
    const notifications = getStoredList(localNotificationKey);
    notifications.unshift({
      id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title || "System activity",
      message: message || "A system action was recorded.",
      roles,
      created_at: new Date().toISOString(),
      is_read: false,
    });
    localStorage.setItem(
      localNotificationKey,
      JSON.stringify(notifications.slice(0, 100)),
    );
  }

  function markLocalNotificationAsRead(id) {
    const notifications = getStoredList(localNotificationKey);
    const notification = notifications.find(
      (item) => String(item.id) === String(id),
    );
    if (!notification) {
      return false;
    }
    notification.is_read = true;
    localStorage.setItem(localNotificationKey, JSON.stringify(notifications));
    return true;
  }

  // Clears every locally-stored (prototype) notification for this browser.
  // Does NOT touch real backend notification records.
  function clearLocalNotifications() {
    localStorage.removeItem(localNotificationKey);
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

  function cleanupOrphanLocalNotifications() {
    // Remove local "New resident registration" notifications that reference
    // residentIds that are no longer in a pending state. Since we can't
    // reliably query the backend here, we remove any local registration
    // notification that was created more than 10 minutes ago — the backend
    // will have handled it by then (approve/reject cleans up).
    try {
      const notifications = getStoredList(localNotificationKey);
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const cleaned = notifications.filter((n) => {
        const isRegistration =
          n.type === "resident_registration" ||
          n.title === "New resident registration" ||
          n.title === "New resident application";
        if (isRegistration) {
          const createdAt = new Date(n.created_at).getTime();
          // Remove if older than 10 minutes (backend should have processed it)
          // OR if it has no residentId (invalid/incomplete notification)
          if (isNaN(createdAt) || createdAt < tenMinutesAgo || !n.residentId) {
            return false;
          }
        }
        return true;
      });
      if (cleaned.length !== notifications.length) {
        localStorage.setItem(localNotificationKey, JSON.stringify(cleaned));
      }
    } catch (error) {
      // Silently fail – not critical for core functionality
    }
  }

  function getFallbackNotifications(role) {
    cleanupOrphanLocalNotifications();
    const localNotifications = getLocalNotifications(role);
    if (role === "resident") {
      return [
        ...localNotifications,
        {
          id: 1,
          is_read: false,
          title: "Complaint received",
          message: "Your complaint has been received by the barangay office.",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          is_read: true,
          title: "Status updated",
          message: "Complaint CMP-2026-0001 is now In Progress.",
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
    }

    const complaints = getStoredList("bsccarsComplaints").filter(
      (c) => !c.archived,
    );

    return [
      ...localNotifications,
      {
        id: 2,
        is_read: false,
        title: `${complaints.length} new complaint${complaints.length !== 1 ? "s" : ""}`,
        message: "Newly submitted complaints need review.",
        created_at: new Date().toISOString(),
      },
    ];
  }

  function isObsoleteDemoApproval(notification, role) {
    if (
      role === "resident" ||
      notification.title !== "New resident application"
    ) {
      return false;
    }
    return !getStoredList("bsccarsPendingResidents").some(
      (resident) => !resident.archived && resident.status === "Pending",
    );
  }

  function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d)
      ? iso
      : d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  }

  // Shared row markup used by both the dropdown panel and the "all
  // notifications" modal, so the two stay visually consistent.
  function buildNotificationItemHTML(n) {
    const typeAttr = n.type ? ` data-type="${escapeHtml(n.type)}"` : "";
    const residentAttr = n.residentId
      ? ` data-resident-id="${escapeHtml(n.residentId)}"`
      : "";
    const clickable =
      n.type === "resident_registration" ? ' style="cursor:pointer;"' : "";
    return `
      <div class="notif-item ${n.is_read ? "" : "notif-item--unread"}" data-id="${n.id}"${typeAttr}${residentAttr}${clickable}>
        <div class="notif-item__body">
          <p class="notif-item__title">${escapeHtml(n.title)}</p>
          <p class="notif-item__msg" style="white-space:normal;">${escapeHtml(n.message)}</p>
          <span class="notif-item__time">${formatTime(n.created_at)}</span>
        </div>
        ${!n.is_read ? `<button class="notif-item__mark" data-mark="${n.id}" title="Mark as read">•</button>` : ""}
      </div>`;
  }

  function buildPanelHTML(notifications, isExpanded) {
  const unread = notifications.filter((n) => !n.is_read).length;
  const visible = isExpanded ? notifications : notifications.slice(0, 5);
  const items = visible.map(buildNotificationItemHTML).join("");
  const showViewAll = !isExpanded && notifications.length > 5;

  return `
    <div class="notif-panel__header">
      <span class="notif-panel__title">Notifications</span>
      ${unread > 0 ? `<span class="notif-panel__badge">${unread} new</span>` : ""}
    </div>
    <div class="notif-panel__list" id="notifList">
      ${items || '<p class="notif-panel__empty">No notifications yet.</p>'}
    </div>
    ${showViewAll ? `
      <div class="notif-panel__footer">
        <a href="#" class="notif-panel__view-all" id="notifViewAllLink">View all (${notifications.length})</a>
      </div>` : ""}
  `;
}

  function wireMarkAsRead(scopeEl, onMarked) {
    scopeEl.querySelectorAll("[data-mark]").forEach((markBtn) => {
      markBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = markBtn.dataset.mark;
        if (!markLocalNotificationAsRead(id)) {
          try {
            await api.markNotificationAsRead?.(id);
          } catch {}
        }
        await onMarked();
      });
    });
  }

  function init() {
    /* Find the button the HTML already declared */
    const btn = document.querySelector(
      '.top-right button[aria-label="Notifications"]',
    );
    if (!btn) return;

    const topRight = btn.closest(".top-right");

    const panel = document.createElement("div");
    panel.className = "notif-panel";
    panel.id = "notifPanel";
    panel.setAttribute("aria-label", "Notifications panel");
    panel.setAttribute("role", "dialog");
    btn.insertAdjacentElement("afterend", panel);

    let lastNotifications = [];

    let expanded = false;

    async function loadAndRender() {
      let notifications = [];
      // Clean up stale local registration notifications on every load
      cleanupOrphanLocalNotifications();
      try {
        const res = await api.getNotifications?.();
        if (res?.success && Array.isArray(res.data)) {
          const role = getUser()?.role || inferRole();
          notifications = [
            ...getLocalNotifications(role),
            ...res.data.filter(
              (notification) => !isObsoleteDemoApproval(notification, role),
            ),
          ];
        } else {
          throw new Error("no backend data");
        }
      } catch {
        const role = getUser()?.role || inferRole();
        notifications = getFallbackNotifications(role);
      }

      lastNotifications = notifications;
      panel.innerHTML = buildPanelHTML(notifications, expanded);

      const unread = notifications.filter((n) => !n.is_read).length;
      let badge = btn.querySelector(".notif-btn-badge");
      if (unread > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "notif-btn-badge";
          btn.appendChild(badge);
        }
        badge.textContent = unread;
        badge.style.display = "flex";
      } else if (badge) {
        badge.style.display = "none";
      }

      wireMarkAsRead(panel, loadAndRender);

      // Click-to-navigate for resident_registration notifications
      panel
        .querySelectorAll('[data-type="resident_registration"]')
        .forEach((item) => {
          item.addEventListener("click", (e) => {
            const markBtn = item.querySelector("[data-mark]");
            if (markBtn && e.target.closest("[data-mark]")) return;
            const residentId = item.dataset.residentId;
            if (residentId) {
              window.location.href =
                "adminResidents.html?highlight=" +
                encodeURIComponent(residentId);
            }
          });
        });

    const viewAllLink = document.getElementById("notifViewAllLink");
    if (viewAllLink) {
      viewAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        expanded = true;
        loadAndRender(); // re-renders panel content, now with expanded = true
  });
}
    }

    loadAndRender();

    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const profPanel = topRight.querySelector("#profilePanel.is-open");
      const profBtn = topRight.querySelector(
        '.icon-badge[aria-label="User profile"]',
      );
      if (profPanel) {
        profPanel.classList.remove("is-open");
        profBtn?.setAttribute("aria-expanded", "false");
      }

      const isOpen = panel.classList.contains("is-open");
      panel.classList.toggle("is-open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!topRight.contains(e.target)) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        expanded = false;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        expanded = false;
      }
    });
  }

  window.BSCCARSNotifications = {
    add: addLocalNotification,
    markAsRead: markLocalNotificationAsRead,
    clearLocal: clearLocalNotifications,
  };

  document.addEventListener("DOMContentLoaded", init);
})();