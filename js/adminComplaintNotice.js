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
      if (complaint.stage) {
        applyNoticeStage(complaint.stage);
      }
      if (complaint.noticeId) {
        window._noticeRecordId = complaint.noticeId;
      }
    } catch (error) {
      console.error("Unable to load notice data:", error);
    }
  }

  // No automatic field prefill: super admin and assistant admin will input all blanks manually.

  if (!window.__bsccarsNoticeAfterPrintBound) {
    window.addEventListener("afterprint", () => {
      if (window._noticePrintPending) {
        window._noticePrintPending = false;
        handlePrintServiceRecording();
      }
    });
    window.__bsccarsNoticeAfterPrintBound = true;
  }

  const stageSelect = document.getElementById("noticeStageSelect");
  if (stageSelect) {
    if (!stageSelect.value) {
      stageSelect.value =
        window._noticeComplaintData?.stage || "first_mediation";
    }
    stageSelect.addEventListener("change", () =>
      applyNoticeStage(stageSelect.value),
    );
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

  applyNoticeStage(getNoticeStage());
  const emailButton = document.getElementById("sendEmailCopyButton");
  const emailHint = document.getElementById("sendEmailCopyHint");
  const respondentEmail = window._noticeComplaintData?.respondentEmail || "";
  if (emailButton) {
    emailButton.style.display = respondentEmail ? "inline-flex" : "none";
    if (emailHint) {
      emailHint.style.display = respondentEmail ? "block" : "none";
      emailHint.textContent = respondentEmail
        ? "Best-effort email only. No read receipt tracking."
        : "";
    }
  }
});

function applyNoticeStage(stage) {
  const stageSelect = document.getElementById("noticeStageSelect");
  const stageLabel = document.getElementById("noticeStageLabel");
  const mediationTemplate = document.getElementById("mediationNoticeTemplate");
  const cfaTemplate = document.getElementById("cfaNoticeTemplate");
  const selectedStage = String(stage || "first_mediation").trim();
  const formHeader = document.querySelector(".kp");

  if (stageSelect) {
    stageSelect.value = selectedStage;
  }

  if (stageLabel) {
    stageLabel.textContent = describeStage(selectedStage);
  }

  if (formHeader) {
    formHeader.textContent =
      selectedStage === "conciliation"
        ? "KP FORM NO. 12"
        : selectedStage === "cfa_issued"
          ? "KP FORM NO. 20"
          : "KP FORM NO. 8";
  }

  const conciliationTemplate = document.getElementById(
    "conciliationNoticeTemplate",
  );

  if (mediationTemplate) {
    mediationTemplate.style.display =
      selectedStage === "cfa_issued" || selectedStage === "conciliation"
        ? "none"
        : "block";
  }
  if (conciliationTemplate) {
    conciliationTemplate.style.display =
      selectedStage === "conciliation" ? "block" : "none";
  }
  if (cfaTemplate) {
    cfaTemplate.style.display =
      selectedStage === "cfa_issued" ? "block" : "none";
  }
}

function getNoticeStage() {
  return (
    document.getElementById("noticeStageSelect")?.value || "first_mediation"
  );
}

function getNoticeInputValue(primaryId, fallbackId) {
  const primary = document.getElementById(primaryId)?.value || "";
  if (primary && primary.trim() !== "") {
    return primary;
  }
  const fallback = document.getElementById(fallbackId)?.value || "";
  return fallback;
}

function getNoticeServiceMethodValue() {
  return (
    document.getElementById("noticeServedMethodSelect")?.value || ""
  ).trim();
}

function getNoticeServiceAtValue() {
  return (document.getElementById("noticeServedAtInput")?.value || "").trim();
}

function buildNoticePayloadFromForm(overrides = {}) {
  const stage = getNoticeStage();
  const complaintId = formatComplaintNumber(
    getNoticeInputValue(
      stage === "cfa_issued"
        ? "cfaComplaintNumber"
        : stage === "conciliation"
          ? "conciliationComplaintNumber"
          : "complaintNumber",
      "complaintNumber",
    ),
  );
  const complainant = getNoticeInputValue(
    stage === "cfa_issued"
      ? "cfaComplainantName"
      : stage === "conciliation"
        ? "conciliantName"
        : "complainantName",
    "complainantName",
  ).trim();

  const outcome =
    document.getElementById("noticeOutcomeSelect")?.value || "pending";
  const noticeServedMethod =
    overrides.noticeServedMethod ?? getNoticeServiceMethodValue();
  const noticeServedAt = overrides.noticeServedAt ?? getNoticeServiceAtValue();

  return {
    complaintId,
    complainant,
    complaintTitle: window._noticeComplaintData?.title || "",
    category: window._noticeComplaintData?.category || "",
    source: window._noticeComplaintData?.source || "",
    details: window._noticeComplaintData?.details || "",
    stage,
    outcome,
    notice_served_method: noticeServedMethod,
    notice_served_at: noticeServedAt,
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
}

async function persistNoticeRecord(options = {}) {
  const payload = buildNoticePayloadFromForm(options);
  const { complaintId, complainant } = payload;
  if (!complaintId || !complainant) {
    alert(
      "Please make sure the complaint reference and complainant name are available before saving.",
    );
    return null;
  }

  const noticeData = payload;
  localStorage.setItem("lastHearingNotice", JSON.stringify(noticeData));

  if (typeof api !== "undefined" && api.post && api.patch) {
    try {
      let noticeRecord;
      if (window._noticeRecordId) {
        noticeRecord = await api.patch(
          `/hearing-notices/${window._noticeRecordId}/outcome`,
          {
            stage: noticeData.stage,
            outcome: noticeData.outcome,
            notice_served_method: noticeData.notice_served_method,
            notice_served_at: noticeData.notice_served_at,
          },
        );
      } else {
        noticeRecord = await api.post("/hearing-notices", {
          complaint_id: complaintId,
          stage: noticeData.stage,
          outcome: noticeData.outcome,
          notice_served_method: noticeData.notice_served_method,
          notice_served_at: noticeData.notice_served_at,
        });
        if (noticeRecord?.data?.id) {
          window._noticeRecordId = noticeRecord.data.id;
          const storedNotice =
            JSON.parse(
              sessionStorage.getItem("selectedComplaintForNotice") || "{}",
            ) || {};
          storedNotice.noticeId = noticeRecord.data.id;
          storedNotice.stage = noticeData.stage;
          sessionStorage.setItem(
            "selectedComplaintForNotice",
            JSON.stringify(storedNotice),
          );
        }
        if (window._noticeRecordId) {
          noticeRecord = await api.patch(
            `/hearing-notices/${window._noticeRecordId}/outcome`,
            {
              stage: noticeData.stage,
              outcome: noticeData.outcome,
              notice_served_method: noticeData.notice_served_method,
              notice_served_at: noticeData.notice_served_at,
            },
          );
        }
      }
      return noticeRecord?.data || noticeRecord;
    } catch (error) {
      console.warn(
        "Unable to sync notice to backend. Saved locally instead.",
        error,
      );
    }
  }

  return null;
}

async function saveNotice() {
  const savedNotice = await persistNoticeRecord();
  if (savedNotice) {
    alert(
      "Hearing notice has been saved and synced to the proceedings record.",
    );
    return;
  }

  alert(
    "Hearing notice has been saved locally. You can now print it or return to the complaints list.",
  );
}

function formatServiceDateTime(value) {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) {
    return "";
  }
  const pad = (part) => String(part).padStart(2, "0");
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}T${pad(source.getHours())}:${pad(source.getMinutes())}`;
}

function promptForServiceDetails() {
  const currentMethod = getNoticeServiceMethodValue() || "printed";
  const currentAt =
    getNoticeServiceAtValue() || formatServiceDateTime(new Date());
  const method = window.prompt(
    "Service method for this notice (printed, email, or in_person)",
    currentMethod,
  );
  if (!method) {
    return null;
  }
  const servedAt = window.prompt(
    "Service date and time (YYYY-MM-DDTHH:mm)",
    currentAt,
  );
  return {
    noticeServedMethod: method.trim().toLowerCase(),
    noticeServedAt: servedAt ? servedAt.trim() : currentAt,
  };
}

async function handlePrintServiceRecording() {
  const details = promptForServiceDetails();
  if (!details) {
    return;
  }
  const savedNotice = await persistNoticeRecord({
    noticeServedMethod: details.noticeServedMethod,
    noticeServedAt: details.noticeServedAt,
  });
  if (savedNotice) {
    const methodLabel = details.noticeServedMethod || "printed";
    const promptedTime = details.noticeServedAt || new Date().toISOString();
    document.getElementById("noticeServedMethodSelect").value = methodLabel;
    document.getElementById("noticeServedAtInput").value = promptedTime
      .replace(" ", "T")
      .slice(0, 16);
    alert("Notice service details were recorded for this hearing notice.");
  }
}

function printNotice() {
  window._noticePrintPending = true;
  window.print();
}

async function sendEmailCopy() {
  if (!window._noticeRecordId) {
    const savedNotice = await persistNoticeRecord();
    if (!window._noticeRecordId && !savedNotice) {
      alert("Please save the notice before sending an email copy.");
      return;
    }
  }

  if (typeof api !== "undefined" && api.sendHearingNoticeEmailCopy) {
    try {
      await api.sendHearingNoticeEmailCopy(window._noticeRecordId);
      alert(
        "Best-effort email copy requested. No read receipt tracking is available.",
      );
    } catch (error) {
      alert(error.message || "Email delivery is not configured yet.");
    }
    return;
  }

  alert("Email delivery is not configured yet.");
}

function backToComplaints() {
  sessionStorage.removeItem("selectedComplaintForNotice");
  window.location.href = "adminComplaints.html";
}

function describeStage(stage) {
  return (
    {
      first_mediation: "First Mediation",
      second_mediation: "Second Mediation",
      conciliation: "Conciliation",
      cfa_issued: "CFA Issued",
    }[String(stage || "first_mediation").trim()] || "First Mediation"
  );
}

function formatComplaintNumber(value) {
  const raw = String(value || "").trim();
  if (/^CMP-\d{4}-\d{4}$/.test(raw)) {
    return raw;
  }

  const yearSequence = raw.match(/(?:#C-)?(?:CMP-)?(\d{4})[-\s]?(\d+)/);
  if (yearSequence) {
    return `CMP-${yearSequence[1]}-${yearSequence[2].padStart(4, "0").slice(-4)}`;
  }

  const sequenceOnly = raw.match(/^(\d+)$/);
  if (sequenceOnly) {
    return `CMP-2026-${sequenceOnly[1].padStart(4, "0").slice(-4)}`;
  }

  return raw;
}