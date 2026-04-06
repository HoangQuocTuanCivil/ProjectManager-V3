import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("revenue_entries")
    .select("product_service_id, amount, status, recognition_date, product_service:product_services(id, code, name, category)")
    .eq("status", "confirmed")
    .not("product_service_id", "is", null);

  if (from) query = query.gte("recognition_date", from);
  if (to) query = query.lte("recognition_date", to);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const map = new Map<string, {
    product_service_id: string;
    code: string;
    name: string;
    category: string;
    total: number;
    entry_count: number;
  }>();

  for (const row of data ?? []) {
    if (!row.product_service_id) continue;
    const ps = row.product_service as any;
    let entry = map.get(row.product_service_id);
    if (!entry) {
      entry = {
        product_service_id: row.product_service_id,
        code: ps?.code ?? "",
        name: ps?.name ?? "",
        category: ps?.category ?? "",
        total: 0,
        entry_count: 0,
      };
      map.set(row.product_service_id, entry);
    }
    entry.total += Number(row.amount);
    entry.entry_count++;
  }

  const result = Array.from(map.values()).sort((a, b) => b.total - a.total);
  return jsonResponse(result);
}
