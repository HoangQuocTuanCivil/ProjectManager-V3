import { NextRequest } from "next/server";
import { getAuthProfile, getServerSupabase, jsonResponse, errorResponse } from "@/lib/api/helpers";

export async function GET(req: NextRequest) {
  const { profile } = await getAuthProfile();
  if (!profile) return errorResponse("Unauthorized", 401);

  const supabase = await getServerSupabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [entriesRes, contractsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("revenue_entries")
        .select("contract_id, amount, status, recognition_date")
        .eq("status", "confirmed")
        .not("contract_id", "is", null);
      if (from) q = q.gte("recognition_date", from);
      if (to) q = q.lte("recognition_date", to);
      return q;
    })(),
    supabase
      .from("contracts")
      .select("id, contract_no, title")
      .is("deleted_at", null),
  ]);

  if (entriesRes.error) return errorResponse(entriesRes.error.message, 500);

  const contractMap = new Map(
    (contractsRes.data ?? []).map(c => [c.id, c])
  );

  const map = new Map<string, { contract_id: string; contract_no: string; contract_title: string; total: number; entry_count: number }>();

  for (const row of entriesRes.data ?? []) {
    if (!row.contract_id) continue;
    const c = contractMap.get(row.contract_id);
    if (!c) continue;
    let entry = map.get(row.contract_id);
    if (!entry) {
      entry = { contract_id: row.contract_id, contract_no: c.contract_no, contract_title: c.title, total: 0, entry_count: 0 };
      map.set(row.contract_id, entry);
    }
    entry.total += Number(row.amount);
    entry.entry_count++;
  }

  return jsonResponse(Array.from(map.values()).sort((a, b) => b.total - a.total));
}
