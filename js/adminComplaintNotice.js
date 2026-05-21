document.addEventListener("DOMContentLoaded", () => {
  const stored = sessionStorage.getItem("selectedComplaintForNotice");
  const dateEl = document.getElementById("printDate");
  const filePathEl = document.getElementById("filePath");
  if (dateEl) {
    const now = new Date();
    const formatted = now.toLocaleDateString();
    dateEl.textContent = formatted;
  }
  if (filePathEl) {
    try {
      filePathEl.textContent = window.location.href;
    } catch (e) {
      filePathEl.textContent = "";
    }
  }
  if (stored) {
    try {
      const complaint = JSON.parse(stored);
      window._noticeComplaintData = complaint;
    } catch (error) {
      console.error("Unable to load notice data:", error);
    }
  }

  const signoutBtn = document.querySelector(".signout");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        window.location.href = "index.html";
      }
    });
  }

});

function saveNotice() {
  const complaintId = (window._noticeComplaintData?.id || "").toString();
  const complainant = (
    document.getElementById("complainantName")?.value || ""
  ).trim();
  if (!complaintId || !complainant) {
    alert(
      "Please make sure the complaint reference and complainant name are available before saving.",
    );
    return;
  }

  const noticeData = {
    complaintId,
    complainant,
    complaintTitle: window._noticeComplaintData?.title || "",
    category: window._noticeComplaintData?.category || "",
    source: window._noticeComplaintData?.source || "",
    details: window._noticeComplaintData?.details || "",
    hearingDay: document.getElementById("hearingDay")?.value || "",
    hearingMonth: document.getElementById("hearingMonth")?.value || "",
    hearingYear: document.getElementById("hearingYear")?.value || "",
    hearingTime: document.getElementById("hearingTime")?.value || "",
    hearingPeriod: document.getElementById("hearingPeriod")?.value || "",
    noticeDay: document.getElementById("noticeDay")?.value || "",
    noticeMonth: document.getElementById("noticeMonth")?.value || "",
    noticeYear: document.getElementById("noticeYear")?.value || "",
    noticeAMPM: document.getElementById("noticeAMPM")?.value || "",
    notificationDay: document.getElementById("notificationDay")?.value || "",
    notificationMonth:
      document.getElementById("notificationMonth")?.value || "",
    notificationYear: document.getElementById("notificationYear")?.value || "",
    notificationAMPM: document.getElementById("notificationAMPM")?.value || "",
    punongBarangay: document.getElementById("punongBarangay")?.value || "",
  };

  localStorage.setItem("lastHearingNotice", JSON.stringify(noticeData));
  alert(
    "Hearing notice has been saved locally. You can now print it or return to the complaints list.",
  );
}

function printNotice() {
  setTimeout(() => window.print(), 120);
}

function backToComplaints() {
  sessionStorage.removeItem("selectedComplaintForNotice");
  window.location.href = "adminComplaints.html";
}