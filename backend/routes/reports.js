const express = require("express");
const db = require("../db");
const { addUserActivity } = require("../data/mockData");

const router = express.Router();

const RESIDENTS_TABLE = "residents";
const COMPLAINTS_TABLE = "complaints";

function quoteId(identifier) {
  return `\`${String(identifier).replace(/`/g, "``")}\``;
}

async function getColumns(tableName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${quoteId(tableName)}`);
  return new Set(rows.map((row) => row.Field));
}

function firstColumn(columns, names) {
  return names.find((name) => columns.has(name)) || null;
}

function column(columns, names, fallback = "NULL") {
  const name = firstColumn(columns, names);
  return name ? quoteId(name) : fallback;
}

function archivedWhere(columns, alias = "") {
  const prefix = alias ? `${quoteId(alias)}.` : "";
  const archived = firstColumn(columns, ["is_archived", "archived"]);
  if (!archived) {
    return "1 = 1";
  }
  return `COALESCE(${prefix}${quoteId(archived)}, 0) = 0`;
}

function normalizeStatus(status) {
  const raw = String(status || "Pending").trim().toLowerCase();
  const key = raw.replace(/[_\s]+/g, "-");
  if (["resolved", "closed", "completed"].includes(key)) return "Resolved";
  if (["in-progress", "progress", "ongoing"].includes(key)) return "In Progress";
  return "Pending";
}

function monthExpr(dateExpression) {
  return `DATE_FORMAT(${dateExpression}, '%Y-%m')`;
}

function shouldUseDatabase() {
  return Boolean(process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME);
}

function getDemoComplaints() {
  const { complaints: demoComplaints, getUserById } = require("../data/mockData");
  return (demoComplaints || [])
  .filter((complaint) => !complaint.archived && !complaint.is_archived)
  .map((complaint) => {
    const user = getUserById(complaint.submitterId);
    const residentName = user
      ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ")
      : "Unknown Resident";

    return {
      ...complaint,
      status: normalizeStatus(complaint.status),
      resident: residentName,
      createdAt: complaint.createdAt || new Date().toISOString(),
    };
  });
}

function demoStatusTotals(demoComplaints) {
  const totals = {
    Pending: 0,
    "In Progress": 0,
    Resolved: 0,
  };
  demoComplaints.forEach((complaint) => {
    totals[normalizeStatus(complaint.status)] += 1;
  });
  return Object.entries(totals).map(([status, total]) => ({ status, total }));
}

function buildDemoDashboardSummary() {
  const {
    demoUsersByEmail,
    residentApplications,
  } = require("../data/mockData");

  const normalizedComplaints = getDemoComplaints();
  const approvedResidents = Object.values(demoUsersByEmail || {}).filter(
    (user) => user.role === "resident",
  );
  const pendingApplications = (residentApplications || []).filter(
    (resident) =>
      !resident.archived &&
      !resident.is_archived &&
      String(resident.status || "").toLowerCase() === "pending",
  );
  const recentComplaints = normalizedComplaints.slice(0, 10).map((c) => ({
    id: c.id || "",
    resident: c.resident,
    title: c.title || c.details || "",
    category: c.category || "",
    status: c.status,
    submittedAt: c.createdAt || new Date().toISOString(),
  }));

  return {
    totalResidents: approvedResidents.length,
    pendingAccounts: pendingApplications.length,
    totalComplaints: normalizedComplaints.length,
    highPriorityComplaints: normalizedComplaints.filter(
      (c) => (c.priority || "").toLowerCase() === "high",
    ).length,
    complaintsByStatus: demoStatusTotals(normalizedComplaints),
    recentComplaints,
  };
}

async function fetchDashboardSummary() {
  try {
    if (!shouldUseDatabase()) {
      throw new Error("Database is not configured.");
    }
    const residentColumns = await getColumns(RESIDENTS_TABLE);
    const complaintColumns = await getColumns(COMPLAINTS_TABLE);

    const residentStatus = column(residentColumns, ["status"], "NULL");
    const complaintStatus = column(complaintColumns, ["status"], "'Pending'");
    const complaintPriority = column(
      complaintColumns,
      ["priority"],
      "'Normal'",
    );
    const createdAt = column(
      complaintColumns,
      ["submitted_at", "created_at", "date", "incident_date"],
      "NOW()",
    );
    const title = column(
      complaintColumns,
      ["title", "subject"],
      "'Untitled complaint'",
    );
    const category = column(
      complaintColumns,
      ["category", "category_name"],
      "'Uncategorized'",
    );
    const residentName = column(
      complaintColumns,
      ["resident_name", "complainant_name", "name", "submitted_by"],
      "'Resident'",
    );

    const [residentCounts] = await db.query(`
    SELECT
      SUM(CASE
        WHEN ${residentStatus} IS NULL OR LOWER(${residentStatus}) IN ('approved', 'active', 'verified')
        THEN 1 ELSE 0
      END) AS totalResidents,
      SUM(CASE
        WHEN LOWER(${residentStatus}) IN ('pending', 'pending approval')
        THEN 1 ELSE 0
      END) AS pendingAccounts
    FROM ${quoteId(RESIDENTS_TABLE)}
    WHERE ${archivedWhere(residentColumns)}
  `);

    const [complaintCounts] = await db.query(`
    SELECT
      COUNT(*) AS totalComplaints,
      SUM(CASE WHEN LOWER(${complaintPriority}) IN ('high', 'urgent', 'critical') THEN 1 ELSE 0 END) AS highPriorityComplaints
    FROM ${quoteId(COMPLAINTS_TABLE)}
    WHERE ${archivedWhere(complaintColumns)}
  `);

    const [statusRows] = await db.query(`
    SELECT ${complaintStatus} AS status, COUNT(*) AS total
    FROM ${quoteId(COMPLAINTS_TABLE)}
    WHERE ${archivedWhere(complaintColumns)}
    GROUP BY ${complaintStatus}
  `);
    const statusTotals = {
      Pending: 0,
      "In Progress": 0,
      Resolved: 0,
    };
    statusRows.forEach((row) => {
      statusTotals[normalizeStatus(row.status)] += Number(row.total || 0);
    });

    const [recentComplaints] = await db.query(`
    SELECT
      ${column(complaintColumns, ["id", "complaint_id"], "NULL")} AS id,
      ${residentName} AS resident,
      ${title} AS title,
      ${category} AS category,
      ${complaintStatus} AS status,
      ${createdAt} AS submittedAt
    FROM ${quoteId(COMPLAINTS_TABLE)}
    WHERE ${archivedWhere(complaintColumns)}
    ORDER BY ${createdAt} DESC
    LIMIT 10
  `);

    return {
      totalResidents: Number(residentCounts[0]?.totalResidents || 0),
      pendingAccounts: Number(residentCounts[0]?.pendingAccounts || 0),
      totalComplaints: Number(complaintCounts[0]?.totalComplaints || 0),
      highPriorityComplaints: Number(
        complaintCounts[0]?.highPriorityComplaints || 0,
      ),
      complaintsByStatus: Object.entries(statusTotals).map(([status, total]) => ({
        status,
        total,
      })),
      recentComplaints: recentComplaints.map((row) => ({
        ...row,
        status: normalizeStatus(row.status),
      })),
    };
  } catch (dbError) {
    // If DB is not available (local dev without MySQL), return a safe mock
    // summary using in-memory demo data so the UI can still render.
    return buildDemoDashboardSummary();
  }
}

function buildDemoCategoryReport() {
  const grouped = new Map();
  getDemoComplaints().forEach((complaint) => {
    const key = complaint.category || "Uncategorized";
    if (!grouped.has(key)) {
      grouped.set(key, {
        category: key,
        totalComplaints: 0,
        highPriority: 0,
        highPriorityRate: 0,
        avgResolutionDays: null,
        exampleComplaint: complaint.title || complaint.details || "",
      });
    }
    const row = grouped.get(key);
    row.totalComplaints += 1;
    if (String(complaint.priority || "").toLowerCase() === "high") {
      row.highPriority += 1;
    }
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      highPriorityRate: row.totalComplaints
        ? Number(((row.highPriority / row.totalComplaints) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.totalComplaints - a.totalComplaints);
}

function buildDemoMonthlyReport() {
  const totals = new Map();
  getDemoComplaints().forEach((complaint) => {
    const month = String(complaint.createdAt || new Date().toISOString()).slice(0, 7);
    totals.set(month, (totals.get(month) || 0) + 1);
  });
  return Array.from(totals.entries())
    .map(([month, totalComplaints]) => ({ month, totalComplaints }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function buildDemoResolutionReport() {
  return buildDemoCategoryReport()
    .map((row) => {
      const resolved = getDemoComplaints().filter(
        (complaint) =>
          complaint.category === row.category &&
          normalizeStatus(complaint.status) === "Resolved",
      );
      return {
        category: row.category,
        resolvedComplaints: resolved.length,
        avgResolutionDays: resolved.length ? 0 : null,
      };
    })
    .filter((row) => row.resolvedComplaints > 0);
}

function buildDemoPriorityReport() {
  return buildDemoCategoryReport()
    .filter((row) => row.highPriority > 0)
    .sort((a, b) => b.highPriority - a.highPriority);
}

router.get("/overview", async (req, res, next) => {
  try {
    const data = await fetchDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: buildDemoCategoryReport() });
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const data = await fetchDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: true, data: buildDemoDashboardSummary() });
  }
});

router.get("/by-category", async (req, res, next) => {
  try {
    if (!shouldUseDatabase()) {
      throw new Error("Database is not configured.");
    }
    addUserActivity(req.user.id, "Generated report", {
      targetType: "report",
      targetId: "by-category",
      details: "Complaints by Category",
    });
    const columns = await getColumns(COMPLAINTS_TABLE);
    const category = column(
      columns,
      ["category", "category_name"],
      "'Uncategorized'",
    );
    const priority = column(columns, ["priority"], "'Normal'");
    const status = column(columns, ["status"], "'Pending'");
    const createdAt = column(
      columns,
      ["submitted_at", "created_at", "date", "incident_date"],
      "NOW()",
    );
    const resolvedAt = column(
      columns,
      ["resolved_at", "closed_at", "updated_at"],
      "NULL",
    );
    const details = column(
      columns,
      ["details", "description", "title", "subject"],
      "''",
    );

    const [rows] = await db.query(`
      SELECT
        ${category} AS category,
        COUNT(*) AS totalComplaints,
        SUM(CASE WHEN LOWER(${priority}) IN ('high', 'urgent', 'critical') THEN 1 ELSE 0 END) AS highPriority,
        AVG(CASE
          WHEN LOWER(${status}) IN ('resolved', 'closed', 'completed') AND ${resolvedAt} IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, ${createdAt}, ${resolvedAt}) / 24
          ELSE NULL
        END) AS avgResolutionDays,
        MIN(${details}) AS exampleComplaint
      FROM ${quoteId(COMPLAINTS_TABLE)}
      WHERE ${archivedWhere(columns)}
      GROUP BY ${category}
      ORDER BY totalComplaints DESC
    `);

    res.json({
      success: true,
      data: rows.map((row) => ({
        category: row.category || "Uncategorized",
        totalComplaints: Number(row.totalComplaints || 0),
        highPriority: Number(row.highPriority || 0),
        highPriorityRate: row.totalComplaints
          ? Number(((row.highPriority / row.totalComplaints) * 100).toFixed(1))
          : 0,
        avgResolutionDays:
          row.avgResolutionDays === null
            ? null
            : Number(Number(row.avgResolutionDays).toFixed(1)),
        exampleComplaint: row.exampleComplaint || "",
      })),
    });
  } catch (error) {
    res.json({ success: true, data: buildDemoCategoryReport() });
  }
});

router.get("/monthly", async (req, res, next) => {
  try {
    if (!shouldUseDatabase()) {
      throw new Error("Database is not configured.");
    }
    addUserActivity(req.user.id, "Generated report", {
      targetType: "report",
      targetId: "monthly",
      details: "Monthly Volume",
    });
    const columns = await getColumns(COMPLAINTS_TABLE);
    const createdAt = column(
      columns,
      ["submitted_at", "created_at", "date", "incident_date"],
      "NOW()",
    );

    const [rows] = await db.query(`
      SELECT ${monthExpr(createdAt)} AS month, COUNT(*) AS totalComplaints
      FROM ${quoteId(COMPLAINTS_TABLE)}
      WHERE ${archivedWhere(columns)}
      GROUP BY ${monthExpr(createdAt)}
      ORDER BY month ASC
    `);

    res.json({
      success: true,
      data: rows.map((row) => ({
        month: row.month,
        totalComplaints: Number(row.totalComplaints || 0),
      })),
    });
  } catch (error) {
    res.json({ success: true, data: buildDemoMonthlyReport() });
  }
});

router.get("/resolution", async (req, res, next) => {
  try {
    if (!shouldUseDatabase()) {
      throw new Error("Database is not configured.");
    }
    addUserActivity(req.user.id, "Generated report", {
      targetType: "report",
      targetId: "resolution",
      details: "Average Resolution Time",
    });
    const columns = await getColumns(COMPLAINTS_TABLE);
    const category = column(
      columns,
      ["category", "category_name"],
      "'Uncategorized'",
    );
    const status = column(columns, ["status"], "'Pending'");
    const createdAt = column(
      columns,
      ["submitted_at", "created_at", "date", "incident_date"],
      "NOW()",
    );
    const resolvedAt = column(
      columns,
      ["resolved_at", "closed_at", "updated_at"],
      "NULL",
    );

    const [rows] = await db.query(`
      SELECT
        ${category} AS category,
        COUNT(*) AS resolvedComplaints,
        AVG(TIMESTAMPDIFF(HOUR, ${createdAt}, ${resolvedAt}) / 24) AS avgResolutionDays
      FROM ${quoteId(COMPLAINTS_TABLE)}
      WHERE ${archivedWhere(columns)}
        AND LOWER(${status}) IN ('resolved', 'closed', 'completed')
        AND ${resolvedAt} IS NOT NULL
      GROUP BY ${category}
      ORDER BY avgResolutionDays ASC
    `);

    res.json({
      success: true,
      data: rows.map((row) => ({
        category: row.category || "Uncategorized",
        resolvedComplaints: Number(row.resolvedComplaints || 0),
        avgResolutionDays:
          row.avgResolutionDays === null
            ? null
            : Number(Number(row.avgResolutionDays).toFixed(1)),
      })),
    });
  } catch (error) {
    res.json({ success: true, data: buildDemoResolutionReport() });
  }
});

router.get("/priority", async (req, res, next) => {
  try {
    if (!shouldUseDatabase()) {
      throw new Error("Database is not configured.");
    }
    addUserActivity(req.user.id, "Generated report", {
      targetType: "report",
      targetId: "priority",
      details: "High Priority Trends",
    });
    const columns = await getColumns(COMPLAINTS_TABLE);
    const category = column(
      columns,
      ["category", "category_name"],
      "'Uncategorized'",
    );
    const priority = column(columns, ["priority"], "'Normal'");

    const [rows] = await db.query(`
      SELECT
        ${category} AS category,
        COUNT(*) AS totalComplaints,
        SUM(CASE WHEN LOWER(${priority}) IN ('high', 'urgent', 'critical') THEN 1 ELSE 0 END) AS highPriority
      FROM ${quoteId(COMPLAINTS_TABLE)}
      WHERE ${archivedWhere(columns)}
      GROUP BY ${category}
      HAVING highPriority > 0
      ORDER BY highPriority DESC, totalComplaints DESC
    `);

    res.json({
      success: true,
      data: rows.map((row) => ({
        category: row.category || "Uncategorized",
        totalComplaints: Number(row.totalComplaints || 0),
        highPriority: Number(row.highPriority || 0),
        highPriorityRate: row.totalComplaints
          ? Number(((row.highPriority / row.totalComplaints) * 100).toFixed(1))
          : 0,
      })),
    });
  } catch (error) {
    res.json({ success: true, data: buildDemoPriorityReport() });
  }
});

module.exports = router;
