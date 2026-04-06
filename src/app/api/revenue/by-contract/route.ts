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
    .select("contract_id, amount, status, recognition_date, contract:contracts(id, contract_no, title)")
    .eq("status", "confirmed")
    .not("contract_id", "is", null);

  if (from) query = query.gte("recognition_date", from);
  if (to) query = query.lte("recognition_date", to);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500);

  const map = new Map<string, {
    contract_id: string;
    contract_no: string;
    contract_title: string;
    total: number;
    entry_count: number;
  }>();

  for (const row of data ?? []) {
    if (!row.contract_id) continue;
    const c = row.contract as any;
    let entry = map.get(row.contract_id);
    if (!entry) {
      entry = {
        contract_id: row.contract_id,
        contract_no: c?.contract_no ?? "",
        contract_title: c?.title ?? "",
        total: 0,
        entry_count: 0,
      };
      map.set(row.contract_id, entry);
    }
    entry.total += Number(row.amount);
    entry.entry_count++;
  }

  const result = Array.from(map.values()).sort((a, b) => b.total - a.total);
  return jsonResponse(result);
}
