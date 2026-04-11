import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, user:users(id, full_name, avatar_url)")
    .eq("task_id", params.id)
    .order("start_time", { ascending: false });

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const body = await req.json();

  if (!body.duration_minutes || body.duration_minutes <= 0) {
    return errorResponse("Thời gian phải lớn hơn 0", 422);
  }

  const supabase = await getServerSupabase();

  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!task) return errorResponse("Công việc không tồn tại hoặc đã xóa", 404);

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      task_id: params.id,
      user_id: user.id,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_minutes: body.duration_minutes,
      description: body.description || null,
      is_billable: body.is_billable ?? false,
    })
    .select("*, user:users(id, full_name, avatar_url)")
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse(data, 201);
}
