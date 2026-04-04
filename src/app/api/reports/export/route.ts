import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();
  const { type, format = "json", project_id, period_start, period_end } = body;

  if (!type) return errorResponse("type is required (tasks|kpi|allocation|projects)", 400);

  const supabase = await getServerSupabase();
  let data: any[] = [];

  switch (type) {
    case "tasks": {
      let query = supabase
        .from("tasks")
        .select("id, title, status, priority, task_type, kpi_weight, progress, expect_score, actual_score, kpi_variance, start_date, deadline, completed_at, assignee:users!tasks_assignee_id_fkey(full_name), project:projects(code, name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (project_id) query = query.eq("project_id", project_id);
      if (period_start) query = query.gte("created_at", period_start);
      if (period_end) query = query.lte("created_at", period_end);

      const { data: tasks, error } = await query;
      if (error) return errorResponse(error.message, 500);
      data = (tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        type: t.task_type,
        kpi_weight: t.kpi_weight,
        progress: t.progress,
        expect_score: Math.round(t.expect_score),
        actual_score: Math.round(t.actual_score),
        variance: t.kpi_variance != null ? Math.round(t.kpi_variance) : null,
        assignee: t.assignee?.full_name || "",
        project: t.project ? `${t.project.code} - ${t.project.name}` : "",
        start_date: t.start_date,
        deadline: t.deadline,
        completed_at: t.completed_at,
      }));
      break;
    }

    case "kpi": {
      const { data: records, error } = await supabase
        .from("kpi_records")
        .select("*, user:users(full_name, role)")
        .order("period_start", { ascending: false })
        .limit(500);

      if (error) return errorResponse(error.message, 500);
      data = records || [];
      break;
    }

    case "allocation": {
      const { data: results, error } = await supabase
        .from("allocation_results")
        .select("*, user:users(full_name, role), period:allocation_periods(name, period_start, period_end, total_fund, status)")
        .order("weighted_score", { ascending: false })
        .limit(500);

      if (error) return errorResponse(error.message, 500);
      data = (results || []).map((r: any) => ({
        period: r.period?.name || "",
        user: r.user?.full_name || "",
        role: r.user?.role || "",
        task_count: r.task_count,
        weighted_score: Math.round(r.weighted_score * 100) / 100,
        share_percentage: Math.round(r.share_percentage * 10000) / 100,
        allocated_amount: Math.round(r.allocated_amount),
        period_start: r.period?.period_start,
        period_end: r.period?.period_end,
        status: r.period?.status,
      }));
      break;
    }

    case "projects": {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, code, name, status, budget, allocation_fund, start_date, end_date, client, manager:users!projects_manager_id_fkey(full_name)")
        .neq("status", "archived")
        .order("code");

      if (error) return errorResponse(error.message, 500);
      data = (projects || []).map((p: any) => ({
        code: p.code,
        name: p.name,
        status: p.status,
        budget: p.budget,
        allocation_fund: p.allocation_fund,
        manager: p.manager?.full_name || "",
        client: p.client || "",
        start_date: p.start_date,
        end_date: p.end_date,
      }));
      break;
    }

    default:
      return errorResponse(`Unknown export type: ${type}`, 400);
  }

  // Format output
  if (format === "csv") {
    if (data.length === 0) return errorResponse("No data to export", 404);
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(",")
      ),
    ];
    const csv = csvRows.join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return jsonResponse({ type, count: data.length, data });
}
