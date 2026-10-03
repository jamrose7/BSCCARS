const localNotificationKey = "bsccarsLocalNotifications";

let residents = [];
let showArchivedResidents = false;
let residentStatusFilter = "Pending";
let residentSortOrder = "newest";
let pendingRejectResident = null;

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

function updateRegistrationNotification(resident, status) {
  try {
    const notifications =
      JSON.parse(localStorage.getItem(localNotificationKey)) || [];
    const residentName = getResidentName(resident);
    const filtered = notifications.filter(
      (item) =>
        !(
          item.residentId === resident.id ||
          (item.title === "New resident registration" &&
            item.message?.includes(residentName))
        ),
    );
    if (filtered.length === notifications.length) return;
    localStorage.setItem(localNotificationKey, JSON.stringify(filtered));
  } catch (error) {
    console.warn("Unable to update resident notification:", error);
  }
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

function getResidentTime(resident) {
  const value =
    resident.submittedAt ||
    resident.createdAt ||
    resident.created_at ||
    resident.updatedAt ||
    resident.updated_at ||
    "";
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStatusRank(status) {
  return {
    Pending: 0,
    Approved: 1,
    Rejected: 2,
  }[status] ?? 3;
}

function sortResidentsForReview(list) {
  return [...list].sort((a, b) => {
    if (residentSortOrder === "name-az") {
      return getResidentName(a).localeCompare(getResidentName(b), undefined, {
        sensitivity: "base",
      });
    }

    const timeDifference =
      residentSortOrder === "oldest"
        ? getResidentTime(a) - getResidentTime(b)
        : getResidentTime(b) - getResidentTime(a);

    if (timeDifference) {
      return timeDifference;
    }

    return getStatusRank(a.status) - getStatusRank(b.status);
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value);
  }
}

function updateResidentSummary(visibleResidents) {
  const activeResidents = residents.filter((resident) => !isResidentArchived(resident));
  const source = showArchivedResidents ? visibleResidents : activeResidents;

  setText("residentTotalCount", source.length);
  setText(
    "residentPendingCount",
    source.filter((resident) => resident.status === "Pending").length,
  );
  setText(
    "residentApprovedCount",
    source.filter((resident) => resident.status === "Approved").length,
  );
  setText(
    "residentRejectedCount",
    source.filter((resident) => resident.status === "Rejected").length,
  );
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
  const filteredResidents =
    residentStatusFilter === "All"
      ? visibleResidents
      : visibleResidents.filter(
          (resident) => resident.status === residentStatusFilter,
        );
  const sortedResidents = sortResidentsForReview(filteredResidents);

  if (!residentsBody) {
    return;
  }

  updateResidentSummary(visibleResidents);

  if (!sortedResidents.length) {
    const emptyMessage = showArchivedResidents
      ? "No archived resident applications."
      : residentStatusFilter === "All"
        ? "No resident applications yet. New registrations will appear here automatically."
        : `No ${residentStatusFilter.toLowerCase()} resident applications found.`;

    residentsBody.innerHTML = `
    <tr>
      <td class="empty-state" colspan="12">
        ${emptyMessage}
      </td>
    </tr>
  `;
    return;
  }

  residentsBody.innerHTML = sortedResidents
    .map(
      (resident, index) => `
        <tr id="resident-${escapeHtml(resident.id)}" class="${resident.status === "Pending" ? "row-pending" : ""}">
          <td class="number-cell">${index + 1}</td>
          <td>${escapeHtml(resident.firstName)}</td>
          <td>${escapeHtml(resident.lastName)}</td>
          <td>${escapeHtml(resident.middleName || "-")}</td>
          <td>${escapeHtml(resident.suffix || "None")}</td>
          <td class="date-cell">${formatDate(resident.dateOfBirth)}</td>
          <td>${escapeHtml(resident.purok)}</td>
          <td class="nowrap">${escapeHtml(resident.contactNumber)}</td>
          <td class="email-cell">${escapeHtml(resident.email)}</td>
          <td>${resident.emailVerifiedAt ? "Verified" : "Not Verified"}</td>
          <td class="id-cell">${renderIdCell(resident)}</td>
          <td class="action-cell">${renderActions(resident)}</td>
        </tr>
      `,
    )
    .join("");
}

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

  modalTitle.textContent = `${getResidentName(resident)} - Uploaded ID`;
  modalFileName.textContent = resident.validId.name || "Uploaded ID";
  const idDataUrl = resident.validId.dataUrl;

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

function openRejectReasonModal(resident) {
  pendingRejectResident = resident;
  const modal = document.getElementById("rejectReasonModal");
  const nameEl = document.getElementById("rejectReasonResidentName");
  const input = document.getElementById("rejectReasonInput");

  if (!modal) return;

  if (nameEl) {
    nameEl.textContent = `Reject ${getResidentName(resident)}'s account application?`;
  }
  if (input) input.value = "";

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  input?.focus();
}

function closeRejectReasonModal() {
  const modal = document.getElementById("rejectReasonModal");
  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  pendingRejectResident = null;
}

// ---------------------------------------------------------------------
// Actions — now hit the real backend, then reload from the server
// so the table always reflects the system of record.
// ---------------------------------------------------------------------

async function approveResident(resident) {
  try {
    await api.approveResident(resident.id); // POST /api/residents/:id/approve
    updateRegistrationNotification(resident, "Approved");
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(
      `Unable to approve ${getResidentName(resident) || "resident"}: ${error.message}`,
    );
  }
}

async function rejectResident(resident, reason = "") {
  try {
    await api.rejectResident(resident.id, reason);
    updateRegistrationNotification(resident, "Rejected");
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(
      `Unable to reject ${getResidentName(resident) || "resident"}: ${error.message}`,
    );
  }
}

async function archiveResident(resident) {
  try {
    await api.archiveResident(resident.id); // PATCH /api/residents/:id/archive
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
    await loadResidents();
    renderResidents();
  } catch (error) {
    alert(
      `Unable to restore ${getResidentName(resident) || "resident"}: ${error.message}`,
    );
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
  const statusFilterSelect = document.getElementById("residentStatusFilter");
  const sortOrderSelect = document.getElementById("residentSortOrder");

  await loadResidents();
  renderResidents();

  // Handle highlight query parameter for actionable notifications
  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get("highlight");
  if (highlightId) {
    const highlightedResident = residents.find(
      (resident) => resident.id === highlightId,
    );
    if (
      highlightedResident &&
      residentStatusFilter !== "All" &&
      highlightedResident.status !== residentStatusFilter
    ) {
      residentStatusFilter = "All";
      if (statusFilterSelect) {
        statusFilterSelect.value = "All";
      }
      renderResidents();
    }

    setTimeout(() => {
      const rows = document.querySelectorAll("#residentsBody tr");
      for (const row of rows) {
        const actionBtn = row.querySelector(
          'button[data-id="' + highlightId + '"]',
        );
        if (actionBtn) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.style.outline = "3px solid #4ecdc4";
          row.style.outlineOffset = "-3px";
          // Remove highlight after 3 seconds
          setTimeout(() => {
            row.style.outline = "";
            row.style.outlineOffset = "";
          }, 3000);
          break;
        }
      }
      // Clean up the URL without reloading
      if (window.history.replaceState) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    }, 300);
  }

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

      if (button.dataset.action === "reject") {
        openRejectReasonModal(resident);
        return;
      }

      const residentName = getResidentName(resident);

      if (
        button.dataset.action === "approve" &&
        window.confirm(`Approve ${residentName}'s account?`)
      ) {
        await approveResident(resident);
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

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener("change", () => {
      residentStatusFilter = statusFilterSelect.value || "All";
      renderResidents();
    });
  }

  if (sortOrderSelect) {
    sortOrderSelect.addEventListener("change", () => {
      residentSortOrder = sortOrderSelect.value || "newest";
      renderResidents();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeIdModal();
      closeRejectReasonModal();
    }
  });
});

document
  .getElementById("cancelRejectReason")
  ?.addEventListener("click", closeRejectReasonModal);

document
  .getElementById("confirmRejectReason")
  ?.addEventListener("click", async () => {
    if (!pendingRejectResident) return;

    const reason =
      document.getElementById("rejectReasonInput")?.value.trim() || "";
    const resident = pendingRejectResident;

    closeRejectReasonModal();
    await rejectResident(resident, reason);
  });

document
  .getElementById("rejectReasonModal")
  ?.addEventListener("click", (event) => {
    if (event.target.id === "rejectReasonModal") {
      closeRejectReasonModal();
    }
  });
