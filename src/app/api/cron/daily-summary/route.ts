import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return errorResponse("Unauthorized: invalid cron secret", 401);
  }

  try {
    const admin = getAdminSupabase();

    // Generate reports for all active projects
    const { data: projects } = await admin.from("projects").select("id").eq("status", "active");

    const results = [];
    for (const project of projects || []) {
      const { data, error } = await admin.functions.invoke("generate-report", {
        body: { project_id: project.id, report_type: "daily" },
      });
      results.push({ project_id: project.id, success: !error, data });
    }

    return jsonResponse({ success: true, reports_generated: results.length, results });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to generate daily summary", 500);
  }
}
