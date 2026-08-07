document.addEventListener("DOMContentLoaded", () => {
  const stored = sessionStorage.getItem("selectedComplaintForNotice");

  if (stored) {
    try {
      const complaint = JSON.parse(stored);
      window._noticeComplaintData = complaint;
      if (complaint.noticeId) window._noticeRecordId = complaint.noticeId;
    } catch (error) {
      console.error("Unable to load notice data:", error);
    }
  }

  const stageSelect = document.getElementById("noticeStageSelect");

  if (stageSelect) {
    stageSelect.value = window._noticeComplaintData?.stage || "first_mediation";
    stageSelect.addEventListener("change", () => {
      applyNoticeStage(stageSelect.value);
    });
  }

  prefillPartyNames();

  if (!window.__bsccarsNoticeAfterPrintBound) {
    window.addEventListener("afterprint", () => {
      if (window._noticePrintPending) {
        window._noticePrintPending = false;
        handlePrintServiceRecording();
      }
    });
    window.__bsccarsNoticeAfterPrintBound = true;
  }

  const signoutBtn = document.querySelector(".signout");

  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      if (window.confirm("Are you sure you want to sign out?")) {
        window.location.href = "index.html";
      }
    });
  }

  applyNoticeStage(getNoticeStage());
});

const STAGE_CONFIG = {
  first_mediation: {
    templateId: "mediationNoticeTemplate",
    kpForm: "KP FORM NO. 8",
    complainantId: "fmComplainantName",
    respondentId: "fmRespondentName",
    hearing: {
      day: "fmHearingDay",
      month: "fmHearingMonth",
      year: "fmHearingYear",
      time: "fmHearingTime",
    },
  },

  second_mediation: {
    templateId: "secondMediationNoticeTemplate",
    kpForm: "KP FORM NO. 18",
    complainantId: "smComplainantName",
    respondentId: "smRespondentName",
    captionComplainantId: "smComplainantCaption",
    captionRespondentId: "smRespondentCaption",
    hearing: {
      day: "smHearingDay",
      month: "smHearingMonth",
      year: "smHearingYear",
      time: "smHearingTime",
    },
  },

  conciliation: {
    templateId: "conciliationNoticeTemplate",
    kpForm: "KP FORM NO. 12",
    complainantId: "ccComplainantName",
    respondentId: "ccRespondentName",
    hearing: {
      day: "ccHearingDay",
      month: "ccHearingMonth",
      year: "ccHearingYear",
      time: "ccHearingTime",
    },
  },

  cfa_issued: {
    templateId: "cfaNoticeTemplate",
    kpForm: "KP FORM NO. 20",
    captionComplainantId: "cfaComplainantCaption",
    captionRespondentId: "cfaRespondentCaption",
    hearing: null,
  },
};

function applyNoticeStage(stage) {
  const selectedStage = STAGE_CONFIG[stage] ? stage : "first_mediation";
  const config = STAGE_CONFIG[selectedStage];

  const stageSelect = document.getElementById("noticeStageSelect");
  const formHeader = document.getElementById("kpFormNumber");

  if (stageSelect) stageSelect.value = selectedStage;
  if (formHeader) formHeader.textContent = config.kpForm;

  Object.values(STAGE_CONFIG).forEach(({ templateId }) => {
    const template = document.getElementById(templateId);

    if (template) {
      template.classList.toggle(
        "is-hidden",
        templateId !== config.templateId
      );
    }
  });

  prefillPartyNames();
}

function getNoticeStage() {
  const value = document.getElementById("noticeStageSelect")?.value;
  return STAGE_CONFIG[value] ? value : "first_mediation";
}

function prefillPartyNames() {
  const data = window._noticeComplaintData || {};
  const complainantName = String(
    data.name || data.complainant_name || data.complainantName || ""
  ).trim();

  const respondentName = String(
    data.respondent_name || data.respondentName || ""
  ).trim();

  Object.values(STAGE_CONFIG).forEach((config) => {
    setFieldValue(config.complainantId, complainantName);
    setFieldValue(config.respondentId, respondentName);
    setFieldText(config.captionComplainantId, complainantName);
    setFieldText(config.captionRespondentId, respondentName);
  });
}

function setFieldValue(id, value) {
  if (!id || !value) return;

  const element = document.getElementById(id);

  if (element && "value" in element && !element.value.trim()) {
    element.value = value;
  }
}

function setFieldText(id, value) {
  if (!id || !value) return;

  const element = document.getElementById(id);

  if (!element) return;

  if ("value" in element) {
    if (!element.value.trim()) element.value = value;
  } else if (!element.textContent.trim()) {
    element.textContent = value;
  }
}

function getNoticeServiceMethodValue() {
  return (
    document.getElementById("noticeServedMethodSelect")?.value || ""
  ).trim();
}

function getNoticeServiceAtValue() {
  return (
    document.getElementById("noticeServedAtInput")?.value || ""
  ).trim();
}

function buildHearingDateTime(config) {
  if (!config.hearing) {
    return {
      hearingDate: null,
      hearingTime: null,
    };
  }

  const day = getFieldValue(config.hearing.day);
  const month = getFieldValue(config.hearing.month);
  const year = getFieldValue(config.hearing.year);
  const time = getFieldValue(config.hearing.time);

  const monthNumber = normalizeMonth(month);

  const hearingDate =
    day && monthNumber && year
      ? `${year.length === 2 ? "20" + year : year}-${monthNumber}-${String(
          day
        ).padStart(2, "0")}`
      : null;

  return {
    hearingDate,
    hearingTime: time || null,
  };
}

function getFieldValue(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function normalizeMonth(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const numeric = Number(raw);

  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return String(numeric).padStart(2, "0");
  }

  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const index = months.findIndex((month) =>
    month.startsWith(raw.toLowerCase())
  );

  return index >= 0 ? String(index + 1).padStart(2, "0") : "";
}

function getPartyName(config, type) {
  const fieldId =
    type === "complainant"
      ? config.complainantId
      : config.respondentId;

  const captionId =
    type === "complainant"
      ? config.captionComplainantId
      : config.captionRespondentId;

  if (fieldId) {
    return getFieldValue(fieldId);
  }

  if (captionId) {
    const element = document.getElementById(captionId);

    if (!element) return "";

    return (
      ("value" in element ? element.value : element.textContent) || ""
    ).trim();
  }

  return "";
}

function buildNoticePayloadFromForm(overrides = {}) {
  const stage = getNoticeStage();
  const config = STAGE_CONFIG[stage];

  const complaintId = window._noticeComplaintData?.id || "";

  const complainant = getPartyName(config, "complainant");

  const outcome =
    document.getElementById("noticeOutcomeSelect")?.value || "pending";

  const noticeServedMethod =
    overrides.noticeServedMethod ?? getNoticeServiceMethodValue();

  const noticeServedAt =
    overrides.noticeServedAt ?? getNoticeServiceAtValue();

  const { hearingDate, hearingTime } = buildHearingDateTime(config);

  return {
    complaintId,
    complainant,
    complaintTitle: window._noticeComplaintData?.title || "",
    category: window._noticeComplaintData?.category || "",
    source: window._noticeComplaintData?.source || "",
    details: window._noticeComplaintData?.details || "",
    stage,
    outcome,
    hearing_date: hearingDate,
    hearing_time: hearingTime,
    notice_served_method: noticeServedMethod,
    notice_served_at: noticeServedAt,
  };
}

async function persistNoticeRecord(options = {}) {
  const payload = buildNoticePayloadFromForm(options);
  const { complaintId, complainant } = payload;

  if (!complaintId || !complainant) {
    alert("Please make sure the complainant name is filled in before saving.");
    return null;
  }

  localStorage.setItem("lastHearingNotice", JSON.stringify(payload));

  if (typeof api !== "undefined" && api.post && api.patch) {
    try {
      const outcomeBody = {
        stage: payload.stage,
        outcome: payload.outcome,
        hearing_date: payload.hearing_date,
        hearing_time: payload.hearing_time,
        notice_served_method: payload.notice_served_method,
        notice_served_at: payload.notice_served_at,
      };

      let noticeRecord;

      if (window._noticeRecordId) {
        noticeRecord = await api.patch(
          `/hearing-notices/${window._noticeRecordId}/outcome`,
          outcomeBody
        );
      } else {
        noticeRecord = await api.post("/hearing-notices", {
          complaint_id: complaintId,
          ...outcomeBody,
        });

        if (noticeRecord?.data?.id) {
          window._noticeRecordId = noticeRecord.data.id;

          const storedNotice = JSON.parse(
            sessionStorage.getItem("selectedComplaintForNotice") || "{}"
          );

          storedNotice.noticeId = noticeRecord.data.id;
          storedNotice.stage = payload.stage;

          sessionStorage.setItem(
            "selectedComplaintForNotice",
            JSON.stringify(storedNotice)
          );
        }
      }

      return noticeRecord?.data || noticeRecord;
    } catch (error) {
      console.warn(
        "Unable to sync notice to backend. Saved locally instead.",
        error
      );
    }
  }

  return null;
}

async function saveNotice() {
  const savedNotice = await persistNoticeRecord();

  if (savedNotice) {
    alert("Hearing notice has been saved and synced to the proceedings record.");
    return;
  }

  alert(
    "Hearing notice has been saved locally. You can now print it or return to the complaints list."
  );
}

function formatServiceDateTime(value) {
  const source = value ? new Date(value) : new Date();

  if (Number.isNaN(source.getTime())) return "";

  const pad = (part) => String(part).padStart(2, "0");

  return `${source.getFullYear()}-${pad(
    source.getMonth() + 1
  )}-${pad(source.getDate())}T${pad(source.getHours())}:${pad(
    source.getMinutes()
  )}`;
}

function promptForServiceDetails() {
  const currentMethod =
    getNoticeServiceMethodValue() || "printed";

  const currentAt =
    getNoticeServiceAtValue() ||
    formatServiceDateTime(new Date());

  const method = window.prompt(
    "Service method for this notice (printed or in_person)",
    currentMethod
  );

  if (!method) return null;

  const servedAt = window.prompt(
    "Service date and time (YYYY-MM-DDTHH:mm)",
    currentAt
  );

  return {
    noticeServedMethod: method.trim().toLowerCase(),
    noticeServedAt: servedAt ? servedAt.trim() : currentAt,
  };
}

async function handlePrintServiceRecording() {
  const details = promptForServiceDetails();

  if (!details) return;

  const savedNotice = await persistNoticeRecord({
    noticeServedMethod: details.noticeServedMethod,
    noticeServedAt: details.noticeServedAt,
  });

  const methodInput = document.getElementById(
    "noticeServedMethodSelect"
  );

  const servedAtInput = document.getElementById(
    "noticeServedAtInput"
  );

  if (methodInput) {
    methodInput.value = details.noticeServedMethod || "printed";
  }

  if (servedAtInput) {
    servedAtInput.value = details.noticeServedAt
      .replace(" ", "T")
      .slice(0, 16);
  }

  if (savedNotice) {
    alert("Notice service details were recorded for this hearing notice.");
  }
}

function printNotice() {
  window._noticePrintPending = true;
  window.print();
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
    }[String(stage || "first_mediation").trim()] ||
    "First Mediation"
  );
}
