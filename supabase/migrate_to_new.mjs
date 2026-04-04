/**
 * A2Z WorkHub — Data Migration: Old Project -> New Project
 *
 * Transfers all public schema data from Supabase project "Quanlycongviec"
 * to project "Projectmanager" using the Supabase Management API.
 *
 * Prerequisites:
 *   - Both projects must have identical schema (migrations already applied)
 *   - Auth users on new project must exist with matching IDs
 *   - Node.js 18+ (built-in fetch)
 *
 * Usage:
 *   node supabase/migrate_to_new.mjs
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  accessToken: process.env.SUPABASE_ACCESS_TOKEN || "YOUR_ACCESS_TOKEN",
  source: { ref: process.env.SOURCE_REF || "dgakrkzafaocwempzdkk", name: "Quanlycongviec" },
  target: { ref: process.env.TARGET_REF || "pasovctuatcvomzfmrdc", name: "Projectmanager" },
};

/**
 * Tables in FK-safe insertion order.
 * Parent tables appear before any table that references them.
 * Only tables that can contain user data are listed (excludes system-only tables).
 */
const TABLES_IN_FK_ORDER = [
  "organizations",
  "permissions",
  "departments",
  "centers",
  "users",
  "teams",
  "custom_roles",
  "role_permissions",
  "projects",
  "project_members",
  "project_departments",
  "goals",
  "goal_targets",
  "goal_projects",
  "milestones",
  "tasks",
  "task_proposals",
  "task_comments",
  "task_attachments",
  "task_status_logs",
  "task_scores",
  "task_dependencies",
  "task_checklists",
  "checklist_items",
  "time_entries",
  "kpi_configs",
  "allocation_configs",
  "allocation_periods",
  "allocation_results",
  "kpi_records",
  "project_kpi_summary",
  "global_kpi_summary",
  "workflow_templates",
  "workflow_steps",
  "workflow_transitions",
  "task_workflow_state",
  "workflow_history",
  "task_templates",
  "project_templates",
  "intake_forms",
  "form_submissions",
  "notifications",
  "status_updates",
  "dashboards",
  "dashboard_widgets",
  "automation_rules",
  "automation_logs",
  "org_settings",
  "user_invitations",
  "user_sessions",
  "audit_logs",
];

// ─── API Helpers ─────────────────────────────────────────────────────────────

/**
 * Executes a SQL query on a Supabase project via the Management API.
 * Returns the parsed JSON result (array of row objects).
 */
async function runSQL(projectRef, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL failed (${res.status}): ${text}\nQuery: ${sql.slice(0, 200)}`);
  }

  return res.json();
}

/** Shorthand: run SQL on source project */
const fromSource = (sql) => runSQL(CONFIG.source.ref, sql);

/** Shorthand: run SQL on target project */
const onTarget = (sql) => runSQL(CONFIG.target.ref, sql);

/**
 * Escapes a value for safe inclusion in a SQL string literal.
 * Handles null, numbers, booleans, strings, dates, and JSON objects.
 */
function sqlValue(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object") {
    // JSONB columns arrive as parsed objects — re-serialize and quote
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String: escape single quotes
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Fetches the list of GENERATED ALWAYS columns from the target schema.
 * These columns are auto-computed and must be excluded from INSERT statements.
 */
async function getGeneratedColumns() {
  const rows = await onTarget(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND is_generated = 'ALWAYS'
  `);
  const map = {};
  for (const { table_name, column_name } of rows) {
    if (!map[table_name]) map[table_name] = new Set();
    map[table_name].add(column_name);
  }
  return map;
}

// ─── Migration Steps ─────────────────────────────────────────────────────────

/**
 * Step 1: Clear all existing data on the target project.
 * Deletes in reverse FK order to avoid constraint violations.
 * Disables triggers to prevent side effects (notifications, audit logs, etc).
 */
async function clearTargetData() {
  console.log("\n[1/3] Clearing existing data on target...");

  const reversed = [...TABLES_IN_FK_ORDER].reverse();
  const deleteStatements = reversed
    .map((t) => `DELETE FROM public.${t};`)
    .join("\n");

  await onTarget(`
    SET session_replication_role = replica;
    ${deleteStatements}
    SET session_replication_role = DEFAULT;
  `);

  console.log(`      Cleared ${reversed.length} tables.`);
}

/**
 * Step 2: Export data from source and import into target.
 * Processes each table sequentially in FK-safe order.
 * Skips empty tables for efficiency.
 */
async function migrateData() {
  console.log("\n[2/3] Migrating data...\n");

  // Identify generated columns to exclude from INSERT statements
  const generatedCols = await getGeneratedColumns();

  let totalMigrated = 0;
  let tablesWithData = 0;

  for (const table of TABLES_IN_FK_ORDER) {
    // Export all rows from source table
    const rows = await fromSource(`SELECT * FROM public.${table}`);

    if (!rows || rows.length === 0) {
      continue; // Skip empty tables silently
    }

    tablesWithData++;
    const skipCols = generatedCols[table] || new Set();
    const columns = Object.keys(rows[0]).filter((c) => !skipCols.has(c));

    // Build batch INSERT statement with all rows
    // Uses VALUES (...), (...) syntax for efficiency
    const valueRows = rows.map(
      (row) => `(${columns.map((col) => sqlValue(row[col])).join(", ")})`
    );

    const insertSQL = `
      INSERT INTO public.${table} (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES ${valueRows.join(",\n      ")}
      ON CONFLICT DO NOTHING;
    `;

    // Disable triggers during insert to prevent cascading side effects
    await onTarget(`
      SET session_replication_role = replica;
      ${insertSQL}
      SET session_replication_role = DEFAULT;
    `);

    console.log(`      ${table}: ${rows.length} rows`);
    totalMigrated += rows.length;
  }

  console.log(
    `\n      Total: ${totalMigrated} rows across ${tablesWithData} tables.`
  );
}

/**
 * Step 3: Verify data integrity by comparing row counts
 * between source and target for all tables with data.
 */
async function verifyMigration() {
  console.log("\n[3/3] Verifying migration...\n");

  // Build a single query that counts all tables at once
  const countUnions = TABLES_IN_FK_ORDER.map(
    (t) => `SELECT '${t}' AS t, count(*)::int AS n FROM public.${t}`
  ).join(" UNION ALL ");

  const [sourceCounts, targetCounts] = await Promise.all([
    fromSource(`${countUnions} ORDER BY t`),
    onTarget(`${countUnions} ORDER BY t`),
  ]);

  // Index by table name for comparison
  const sourceMap = Object.fromEntries(sourceCounts.map((r) => [r.t, r.n]));
  const targetMap = Object.fromEntries(targetCounts.map((r) => [r.t, r.n]));

  let allMatch = true;

  for (const table of TABLES_IN_FK_ORDER) {
    const s = sourceMap[table] || 0;
    const t = targetMap[table] || 0;

    if (s === 0 && t === 0) continue; // Skip empty tables

    const status = s === t ? "OK" : "MISMATCH";
    const icon = s === t ? "  " : "!!";
    console.log(`    ${icon} ${table}: source=${s} target=${t} ${status}`);

    if (s !== t) allMatch = false;
  }

  console.log(allMatch ? "\n    All counts match." : "\n    WARNING: Some counts differ!");
  return allMatch;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log(" A2Z WorkHub — Data Migration");
  console.log(` Source: ${CONFIG.source.name} (${CONFIG.source.ref})`);
  console.log(` Target: ${CONFIG.target.name} (${CONFIG.target.ref})`);
  console.log("=".repeat(60));

  const start = Date.now();

  try {
    await clearTargetData();
    await migrateData();
    const ok = await verifyMigration();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s.`);

    if (!ok) process.exit(1);
  } catch (err) {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  }
}

main();
