import { NextRequest } from "next/server";
import { verifyCronSecret, getAdminSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return errorResponse("Unauthorized: invalid cron secret", 401);
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.functions.invoke("check-overdue");

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, result: data });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to check overdue tasks", 500);
  }
}
