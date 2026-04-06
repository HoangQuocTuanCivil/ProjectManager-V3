import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, getUntypedAdmin, jsonResponse, errorResponse, requireMinRole, parsePagination } from "@/lib/api/helpers";

const SALARY_SELECT = `
  *,
  user:users!salary_records_user_id_fkey(id, full_name, email),
  department:departments(id, name, code),
  creator:users!salary_records_created_by_fkey(id, full_name)
`;

// Danh sách bảng lương với filter theo tháng, phòng ban, nhân viên
export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const admin = getUntypedAdmin();
  const { searchParams } = new URL(req.url);
  const { from, to, page, per_page } = parsePagination(searchParams);

  let query = admin
    .from("salary_records")
    .select(SALARY_SELECT, { count: "exact" })
    .order("month", { ascending: false })
    .range(from, to);

  const month = searchParams.get("month");
  const dept_id = searchParams.get("dept_id");
  const user_id = searchParams.get("user_id");

  if (month) query = query.eq("month", month);
  if (dept_id) query = query.eq("dept_id", dept_id);
  if (user_id) query = query.eq("user_id", user_id);

  const { data, error, count } = await query;
  if (error) return errorResponse(error.message, 500);

  return jsonResponse({ data, count, page, per_page });
}

// Tạo bảng lương — hỗ trợ nhập hàng loạt (mảng records)
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthProfile();
  if (!user || !profile) return errorResponse("Unauthorized", 401);

  const roleErr = requireMinRole(profile, "leader");
  if (roleErr) return errorResponse(roleErr, 403);

  const body = await req.json();
  const records: any[] = Array.isArray(body) ? body : [body];

  if (records.length === 0) return errorResponse("Dữ liệu trống", 400);
  if (records.length > 200) return errorResponse("Tối đa 200 bản ghi mỗi lần", 400);

  // Validate từng bản ghi trước khi gửi DB
  for (const r of records) {
    if (!r.user_id) return errorResponse("Thiếu user_id", 400);
    if (!r.month || !/^\d{4}-\d{2}-\d{2}$/.test(r.month)) return errorResponse("month phải có dạng YYYY-MM-DD", 400);
    if (typeof r.base_salary !== "number" || r.base_salary < 0) return errorResponse("base_salary phải là số ≥ 0", 400);
  }

  const rows = records.map((r) => ({
    org_id: profile.org_id,
    user_id: r.user_id,
    dept_id: r.dept_id ?? null,
    month: r.month,
    base_salary: r.base_salary,
    notes: r.notes ?? null,
    created_by: user.id,
  }));

  const admin = getUntypedAdmin();
  const { data, error } = await admin
    .from("salary_records")
    .upsert(rows, { onConflict: "org_id,user_id,month" })
    .select(SALARY_SELECT);

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(data, 201);
}
