/**
 * UI Utilities Layer
 *
 * Provides reusable UI helpers:
 * - Notifications (toast system)
 * - Loading overlays
 * - Modal system
 * - Formatting utilities
 * - UI helpers (debounce, clipboard, etc.)
 *
 * NOTE:
 * These utilities assume a browser DOM environment.
 * Avoid using string-based event handlers for security reasons.
 */

// NOTIFICATIONS

function showNotification(message, type = "info", duration = 3000) {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  toast
    .querySelector(".toast-close")
    .addEventListener("click", () => toast.remove());

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return toast;
}

// LOADING

function showLoading(message = "Loading...") {
  const existing = document.getElementById("loadingOverlay");
  if (existing) return existing;

  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loadingOverlay";
  loadingDiv.className = "loading-overlay";

  loadingDiv.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;

  document.body.appendChild(loadingDiv);
  return loadingDiv;
}

function hideLoading() {
  const loading = document.getElementById("loadingOverlay");

  if (!loading) return;

  loading.classList.add("fade-out");
  setTimeout(() => loading.remove(), 300);
}

// MODALS (SAFE VERSION)

function showModal(title, content, buttons = []) {
  closeModal(); // prevent stacking

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "customModal";

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  buttons.forEach((btn) => {
    const button = document.createElement("button");
    button.className = `btn btn-${btn.type || "primary"}`;
    button.textContent = btn.text;

    button.addEventListener("click", () => {
      closeModal();
      btn.onClick?.();
    });

    footer.appendChild(button);
  });

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="modalCloseBtn">&times;</button>
      </div>
      <div class="modal-body">${content}</div>
    </div>
  `;

  modal.querySelector("#modalCloseBtn").addEventListener("click", closeModal);

  modal.appendChild(footer);
  document.body.appendChild(modal);

  return modal;
}

function closeModal() {
  const modal = document.getElementById("customModal");
  if (!modal) return;

  modal.classList.add("fade-out");
  setTimeout(() => modal.remove(), 300);
}

// FORMATTING

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(dateString) {
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

function truncateText(text, length = 100) {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
}

// UI HELPERS

function setButtonLoading(button, isLoading = true) {
  if (!button) return;

  if (isLoading) {
    try {
      button.setAttribute("data-original-text", button.textContent.trim());
    } catch (e) {
      // ignore if cannot set attribute
    }
    button.disabled = true;
    button.innerHTML = '<span class="spinner-small" aria-hidden="true"></span>';
  } else {
    button.disabled = false;
    const original = button.getAttribute("data-original-text");
    if (original) {
      button.textContent = original;
      button.removeAttribute("data-original-text");
    } else {
      // fallback to a sensible default matching common button labels
      const fallback = /sign/i.test(button.className || "")
        ? "Sign in"
        : "Submit";
      button.textContent = fallback;
    }
  }
}

function getStatusBadgeClass(status) {
  return (
    {
      pending: "badge-warning",
      in_progress: "badge-info",
      resolved: "badge-success",
      closed: "badge-secondary",
      rejected: "badge-danger",
    }[status?.toLowerCase()] || "badge-secondary"
  );
}

function getPriorityBadgeClass(priority) {
  return (
    {
      low: "badge-success",
      normal: "badge-info",
      high: "badge-warning",
      critical: "badge-danger",
    }[priority?.toLowerCase()] || "badge-secondary"
  );
}

// UTILITIES

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification("Copied to clipboard", "success", 2000);
  } catch {
    showNotification("Copy failed", "error", 2000);
  }
}

function debounce(func, wait) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
