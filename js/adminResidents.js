const residentActionLogsKey = "bsccarsResidentActionLogs";
const localNotificationKey = "bsccarsLocalNotifications";

let residents = [];
let showArchivedResidents = false;
let pendingDeleteResidentId = null;

function isSuperAdmin() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.role === "super_admin";
  } catch (error) {
    return false;
  }
}

// ---------------------------------------------------------------------
// Data loading (now backed by the real API instead of localStorage)
// ---------------------------------------------------------------------

async function loadResidents() {
  try {
    const response = await api.getAllResidents(); // GET /api/residents/all
    residents = response.data || [];
  } catch (error) {
    console.error("Unable to load residents:", error);
    residents = [];
  }
}

// ---------------------------------------------------------------------
// Local-only helpers (action log + admin notification badge state)
// These stay client-side by design — they're UI conveniences, not
// system-of-record data, so localStorage is fine here.
// ---------------------------------------------------------------------

function updateRegistrationNotification(resident, status) {
  try {
    const notifications = JSON.parse(localStorage.getItem(localNotificationKey)) || [];
    const residentName = getResidentName(resident);
    const notification = notifications.find((item) =>
      item.residentId === resident.id ||
      (item.title === "New resident registration" && item.message?.includes(residentName)),
    );
    if (!notification) return;

    const approved = status === "Approved";
    notification.residentId = resident.id;
    notification.title = approved ? "Resident account approved" : "Resident account rejected";
    notification.message = approved
      ? `${residentName}'s account was approved.`
      : `${residentName}'s account was rejected.`;
    notification.created_at = new Date().toISOString();
    notification.is_read = false;
    localStorage.setItem(localNotificationKey, JSON.stringify(notifications));
  } catch (error) {
    console.warn("Unable to update resident notification:", error);
  }
}

function logResidentAction(action, resident) {
  const entry = {
    action,
    residentId: resident.id,
    residentName: getResidentName(resident),
    email: resident.email || "",
    performedBy:
      typeof api !== "undefined"
        ? api.user?.email || api.user?.name || "Admin"
        : "Admin",
    timestamp: new Date().toISOString(),
  };

  try {
    const logs = JSON.parse(localStorage.getItem(residentActionLogsKey)) || [];
    logs.unshift(entry);
    localStorage.setItem(
      residentActionLogsKey,
      JSON.stringify(logs.slice(0, 200)),
    );
  } catch (error) {
    localStorage.setItem(residentActionLogsKey, JSON.stringify([entry]));
  }

  console.info("Resident action logged:", entry);
}

// ---------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------

function isResidentArchived(resident) {
  return Boolean(resident.is_archived || resident.archived);
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResidentName(resident) {
  return `${resident.firstName || ""} ${resident.lastName || ""}`.trim();
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

function renderActions(resident) {
  const canManageRecords = isSuperAdmin();
  if (isResidentArchived(resident)) {
    if (!canManageRecords) {
      return '<div class="status-archived">Archived</div>';
    }
    return `
      <div class="status-archived">
        Archived
      </div>

      <button
        class="btn-archive"
        type="button"
        data-action="restore"
        data-id="${resident.id}">
        Restore
      </button>

      <button
        class="btn-delete"
        type="button"
        data-action="delete"
        data-id="${resident.id}">
        Delete
      </button>
    `;
  }

  const archiveBtn = `
    <button
      class="btn-archive"
      type="button"
      data-action="archive"
      data-id="${resident.id}">
      Archive
    </button>
  `;

  if (resident.status === "Approved") {
    return `
      <div class="status-approved">
        Approved
      </div>

      ${canManageRecords ? archiveBtn : ""}
    `;
  }

  if (resident.status === "Rejected") {
    return `
      <div class="status-rejected">
        Rejected
      </div>

      ${canManageRecords ? archiveBtn : ""}
    `;
  }

  return `
    <button
      class="btn-action btn-approve"
      type="button"
      data-action="approve"
      data-id="${resident.id}">
      Approve
    </button>

    <button
      class="btn-action btn-reject"
      type="button"
      data-action="reject"
      data-id="${resident.id}">
      Reject
    </button>
  `;
}

function renderIdCell(resident) {
  // The uploaded ID preview URL now comes from the resident record itself
  // (backend-served), not from a browser-local IndexedDB lookup keyed by
  // a client-generated id. If your backend doesn't yet return a viewable
  // URL/dataUrl for validId, this is the field to add server-side.
  if (!resident.validId || !resident.validId.dataUrl) {
    return '<span class="muted">No ID file</span>';
  }

  const fileName = escapeHtml(resident.validId.name || "Uploaded ID");

  return `
    <button class="id-preview-button" type="button" data-action="preview-id" data-id="${resident.id}">
      <span class="id-thumbnail" aria-hidden="true">
        ${
          resident.validId.type && resident.validId.type.includes("pdf")
            ? "PDF"
            : `<img src="${resident.validId.dataUrl}" alt="" />`
        }
      </span>
      <span class="id-file-name">${fileName}</span>
    </button>
  `;
}

function renderResidents() {
  const residentsBody = document.getElementById("residentsBody");
  const visibleResidents = residents.filter((resident) =>
    showArchivedResidents
      ? isResidentArchived(resident)
      : !isResidentArchived(resident),
  );

  if (!residentsBody) {
    return;
  }

  if (!visibleResidents.length) {
    const emptyMessage = showArchivedResidents
      ? "No archived resident applications."
      : "No resident applications yet. New registrations will appear here automatically.";

    residentsBody.innerHTML = `
    <tr>
      <td class="empty-state" colspan="10">
        ${emptyMessage}
      </td>
    </tr>
  `;
    return;
  }

  residentsBody.innerHTML = visibleResidents
    .map(
      (resident) => `
        <tr>
          <td>${escapeHtml(resident.firstName)}</td>
          <td>${escapeHtml(resident.lastName)}</td>
          <td>${escapeHtml(resident.middleName || "-")}</td>
          <td>${escapeHtml(resident.suffix || "None")}</td>
          <td class="date-cell">${formatDate(resident.dateOfBirth)}</td>
          <td>${escapeHtml(resident.purok)}</td>
          <td class="nowrap">${escapeHtml(resident.contactNumber)}</td>
          <td class="email-cell">${escapeHtml(resident.email)}</td>
          <td class="id-cell">${renderIdCell(resident)}</td>
          <td class="action-cell">${renderActions(resident)}</td>
        </tr>
      `,
    )
    .join("");
}

// ---------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------

function openIdModal(resident) {
  const modal = document.getElementById("idModal");
  const modalTitle = document.getElementById("idModalTitle");
  const modalFileName = document.getElementById("idModalFileName");
  const modalBody = document.getElementById("idModalBody");

  if (
    !modal ||
    !modalTitle ||
    !modalFileName ||
    !modalBody ||
    !resident.validId ||
    !resident.validId.dataUrl
  ) {
    return;
  }

  const idDataUrl = resident.validId.dataUrl;

  modalTitle.textContent = `${getResidentName(resident)} - Uploaded ID`;
  modalFileName.textContent = resident.validId.name || "Uploaded ID";

  if (resident.validId.type && resident.validId.type.includes("pdf")) {
    modalBody.innerHTML = `
      <object class="id-document" data="${idDataUrl}" type="application/pdf">
        <a class="id-open-link" href="${idDataUrl}" target="_blank" rel="noopener">
          Open uploaded PDF ID
        </a>
      </object>
    `;
  } else {
    modalBody.innerHTML = `
      <img class="id-full-image" src="${idDataUrl}" alt="${escapeHtml(
        getResidentName(resident),
      )} uploaded ID" />
    `;
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeIdModal() {
  const modal = document.getElementById("idModal");
  const modalBody = document.getElementById("idModalBody");

  if (!modal || !modalBody) {
    return;
  }

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  modalBody.innerHTML = "";
}

function openDeleteResidentModal(resident) {
  const modal = document.getElementById("deleteResidentModal");
  const message = document.getElementById("deleteResidentMessage");

  if (!modal || !message) {
    return;
  }

  pendingDeleteResidentId = resident.id;
  message.textContent = `This will permanently delete ${
    getResidentName(resident) || "this resident"
  } from resident records. This action cannot be undone.`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeDeleteResidentModal() {
  const modal = document.getElementById("deleteResidentModal");

  pendingDeleteResidentId = null;

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

// ---------------------------------------------------------------------
// Actions — now hit the real backend, then reload from the server
// so the table always reflects the system of record.
// ---------------------------------------------------------------------

async function approveResident(resident) {
  try {
    await api.approveResident(resident.id); // POST /api/residents/:id/approve
    logResidentAction("Approve Resident", { ...resident, status: "Approved" });
    updateRegistrationNotification(resident, "Approved");
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(`Unable to approve ${getResidentName(resident) || "resident"}: ${error.message}`);
  }
}

async function rejectResident(resident) {
  try {
    await api.rejectResident(resident.id); // POST /api/residents/:id/reject
    logResidentAction("Reject Resident", { ...resident, status: "Rejected" });
    updateRegistrationNotification(resident, "Rejected");
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(`Unable to reject ${getResidentName(resident) || "resident"}: ${error.message}`);
  }
}

async function archiveResident(resident) {
  try {
    await api.archiveResident(resident.id); // PATCH /api/residents/:id/archive
    logResidentAction("Archive Resident", {
      ...resident,
      archived: true,
      is_archived: true,
    });
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(
      `Unable to archive ${getResidentName(resident) || "resident"}: ${error.message}`,
    );
  }
}

async function restoreResident(resident) {
  try {
    await api.restoreResident(resident.id); // PATCH /api/residents/:id/archive (is_archived: false)
    logResidentAction("Restore Resident", { ...resident, archived: false, is_archived: false });
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(`Unable to restore ${getResidentName(resident) || "resident"}: ${error.message}`);
  }
}

async function deleteResident(resident) {
  try {
    if (!isResidentArchived(resident)) {
      throw new Error("Only archived residents can be permanently deleted.");
    }

    await api.deleteResident(resident.id); // DELETE /api/residents/:id
    logResidentAction("Delete Resident", resident);
    closeDeleteResidentModal();
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(`Unable to delete ${getResidentName(resident)}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// Bootstrapping
// ---------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  const residentsBody = document.getElementById("residentsBody");
  const closeIdModalButton = document.getElementById("closeIdModal");
  const idModal = document.getElementById("idModal");
  const showArchivedToggle = document.getElementById("showArchivedResidents");
  const deleteResidentModal = document.getElementById("deleteResidentModal");
  const cancelDeleteResident = document.getElementById("cancelDeleteResident");
  const confirmDeleteResident = document.getElementById(
    "confirmDeleteResident",
  );

  await loadResidents();
  renderResidents();

  if (residentsBody) {
    residentsBody.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const resident = residents.find((item) => item.id === button.dataset.id);
      if (!resident) {
        return;
      }

      if (button.dataset.action === "preview-id") {
        openIdModal(resident);
        return;
      }

      if (button.dataset.action === "archive") {
        await archiveResident(resident);
        return;
      }

      if (button.dataset.action === "restore") {
        await restoreResident(resident);
        return;
      }

      if (button.dataset.action === "delete") {
        if (!isResidentArchived(resident)) {
          alert("Only archived residents can be permanently deleted.");
          return;
        }
        openDeleteResidentModal(resident);
        return;
      }

      const residentName = getResidentName(resident);

      if (
        button.dataset.action === "approve" &&
        window.confirm(`Approve ${residentName}'s account?`)
      ) {
        await approveResident(resident);
      }

      if (
        button.dataset.action === "reject" &&
        window.confirm(`Reject ${residentName}'s account?`)
      ) {
        await rejectResident(resident);
      }
    });
  }

  if (closeIdModalButton) {
    closeIdModalButton.addEventListener("click", closeIdModal);
  }

  if (idModal) {
    idModal.addEventListener("click", (event) => {
      if (event.target === idModal) {
        closeIdModal();
      }
    });
  }

  if (showArchivedToggle) {
    showArchivedToggle.addEventListener("change", () => {
      showArchivedResidents = showArchivedToggle.checked;
      renderResidents();
    });
  }

  if (cancelDeleteResident) {
    cancelDeleteResident.addEventListener("click", closeDeleteResidentModal);
  }

  if (confirmDeleteResident) {
    confirmDeleteResident.addEventListener("click", async () => {
      const resident = residents.find(
        (item) => item.id === pendingDeleteResidentId,
      );
      if (resident) {
        await deleteResident(resident);
      }
    });
  }

  if (deleteResidentModal) {
    deleteResidentModal.addEventListener("click", (event) => {
      if (event.target === deleteResidentModal) {
        closeDeleteResidentModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeIdModal();
      closeDeleteResidentModal();
    }
  });
});
