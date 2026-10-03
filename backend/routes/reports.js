const express = require("express");
const db = require("../db");
const { addUserActivity } = require("../data/dbActivity");

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

function columnWithAlias(columns, alias, names, fallback = "NULL") {
  const name = firstColumn(columns, names);
  return name ? `${quoteId(alias)}.${quoteId(name)}` : fallback;
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

function reportTitle(type) {
  return {
    category: "Complaints by Category",
    monthly: "Monthly Volume",
    resolution: "Average Resolution Time",
    priority: "High Priority Trends",
    recurring: "Recurring Complaint Activity",
  }[type] || "Report";
}

async function fetchDashboardSummary() {
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
      ${columnWithAlias(complaintColumns, "c", ["id", "complaint_id"], "NULL")} AS id,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''),
        u.email,
        'Unknown resident'
      ) AS resident,
      ${columnWithAlias(complaintColumns, "c", ["title", "subject"], "'Untitled complaint'")} AS title,
      ${columnWithAlias(complaintColumns, "c", ["category", "category_name"], "'Uncategorized'")} AS category,
      ${columnWithAlias(complaintColumns, "c", ["status"], "'Pending'")} AS status,
      ${columnWithAlias(complaintColumns, "c", ["submitted_at", "created_at", "date", "incident_date"], "NOW()")} AS submittedAt
    FROM ${quoteId(COMPLAINTS_TABLE)} c
    LEFT JOIN users u ON u.id = c.submitter_id
    WHERE ${archivedWhere(complaintColumns, "c")}
    ORDER BY ${columnWithAlias(complaintColumns, "c", ["submitted_at", "created_at", "date", "incident_date"], "NOW()")} DESC
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
}

router.get("/overview", async (req, res, next) => {
  try {
    const data = await fetchDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const data = await fetchDashboardSummary();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/by-category", async (req, res, next) => {
  try {
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
    const [rows] = await db.query(`
      SELECT
        ${category} AS category,
        COUNT(*) AS totalComplaints,
        SUM(CASE WHEN LOWER(${priority}) IN ('high', 'urgent', 'critical') THEN 1 ELSE 0 END) AS highPriority,
        AVG(CASE
          WHEN LOWER(${status}) IN ('resolved', 'closed', 'completed') AND ${resolvedAt} IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, ${createdAt}, ${resolvedAt}) / 24
          ELSE NULL
        END) AS avgResolutionDays
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
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/monthly", async (req, res, next) => {
  try {
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
    next(error);
  }
});

router.get("/resolution", async (req, res, next) => {
  try {
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
    next(error);
  }
});

router.get("/priority", async (req, res, next) => {
  try {
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
    next(error);
  }
});

function complainantFullName(row) {
  return [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function respondentFullName(row) {
  return String(row.respondent_name || "").trim();
}

function mostCommonCategory(categories) {
  const counts = new Map();
  categories.filter(Boolean).forEach((category) => {
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ||
    "Uncategorized"
  );
}

function recurringStatusSummary(statusCounts) {
  const labels = { pending: "Pending", "in-progress": "In Progress", resolved: "Resolved" };
  return ["pending", "in-progress", "resolved"]
    .map((key) => `${labels[key]}: ${statusCounts[key] || 0}`)
    .join(", ");
}

function buildRecurringRows(rows, personType) {
  const getName = personType === "complainant" ? complainantFullName : respondentFullName;
  const groups = new Map();

  rows.forEach((row) => {
    const name = getName(row);
    if (!name) return;

    const group =
      groups.get(name) ||
      { name, count: 0, latestDate: null, categories: [], statuses: {} };

    const date = new Date(row.incident_date || row.created_at);
    group.count += 1;
    group.categories.push(row.category || "Uncategorized");
    const statusKey = normalizeStatus(row.status).toLowerCase().replace(/\s+/g, "-");
    group.statuses[statusKey] = (group.statuses[statusKey] || 0) + 1;
    if (!Number.isNaN(date.getTime()) && (!group.latestDate || date > group.latestDate)) {
      group.latestDate = date;
    }

    groups.set(name, group);
  });

  return [...groups.values()]
    .filter((group) => group.count > 1)
    .map((group) => ({
      personType: personType === "complainant" ? "Complainant" : "Reported Respondent",
      name: group.name,
      count: group.count,
      latestDate: group.latestDate ? group.latestDate.toISOString().slice(0, 10) : "No date",
      commonCategory: mostCommonCategory(group.categories),
      statusBreakdown: recurringStatusSummary(group.statuses),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

router.get("/recurring", async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.category, c.status, c.respondent_name, c.created_at, c.incident_date,
        u.first_name, u.middle_name, u.last_name
      FROM complaints c
      LEFT JOIN users u ON u.id = c.submitter_id
      WHERE c.is_archived = FALSE
    `);

    const data = [
      ...buildRecurringRows(rows, "complainant"),
      ...buildRecurringRows(rows, "respondent"),
    ];

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/export-log", async (req, res, next) => {
  try {
    const type = String(req.body?.type || "").trim();
    const format = String(req.body?.format || "").trim().toUpperCase();
    const allowedTypes = new Set(["category", "monthly", "resolution", "priority", "recurring"]);
    const allowedFormats = new Set(["PDF", "CSV"]);

    if (!allowedTypes.has(type) || !allowedFormats.has(format)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report export activity.",
      });
    }

    await addUserActivity(req.user.id, `Exported ${format} report`, {
      targetType: "report",
      targetId: type,
      details: reportTitle(type),
    });

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
