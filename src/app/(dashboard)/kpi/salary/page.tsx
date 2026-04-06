"use client";

import { useState } from "react";
import { useSalaryRecords, useCreateSalaryBatch, useSalaryDeductions } from "@/features/kpi";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/kpi";
import { toast } from "sonner";
import { Wallet, AlertTriangle, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function useDeptUsers(deptId?: string) {
  return useQuery({
    queryKey: ["dept-users", deptId],
    enabled: !!deptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, dept_id")
        .eq("is_active", true)
        .eq("dept_id", deptId!)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

function useDepts() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

type Tab = "input" | "deductions";

export default function SalaryPage() {
  const { user } = useAuthStore();
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const [tab, setTab] = useState<Tab>("input");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [deptId, setDeptId] = useState("");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1" role="tablist">
          {([
            { key: "input" as const, label: "Nhập lương" },
            { key: "deductions" as const, label: "Công nợ khoán" },
          ]).map(v => (
            <button key={v.key} onClick={() => setTab(v.key)} role="tab" aria-selected={tab === v.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-ring ${tab === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "input" && <SalaryInputSection month={month} setMonth={setMonth} deptId={deptId} setDeptId={setDeptId} canManage={canManage} />}
      {tab === "deductions" && <DeductionsSection />}
    </div>
  );
}

/* ─── Nhập lương hàng loạt theo PB + tháng ────────────────────────── */

function SalaryInputSection({ month, setMonth, deptId, setDeptId, canManage }: {
  month: string; setMonth: (v: string) => void;
  deptId: string; setDeptId: (v: string) => void;
  canManage: boolean;
}) {
  const { data: depts = [] } = useDepts();
  const { data: users = [] } = useDeptUsers(deptId || undefined);
  const { data: existing } = useSalaryRecords({ month, dept_id: deptId || undefined });
  const createBatch = useCreateSalaryBatch();

  // Map existing salary by user_id cho pre-fill
  const existingMap = new Map((existing?.data ?? []).map((r: any) => [r.user_id, r]));

  const [rows, setRows] = useState<Record<string, number>>({});

  // Sync rows khi users hoặc existing thay đổi
  const effectiveRows = users.map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    current: existingMap.get(u.id)?.base_salary ?? 0,
    deduction: existingMap.get(u.id)?.deduction_applied ?? 0,
    net: existingMap.get(u.id)?.net_salary ?? 0,
    input: rows[u.id] ?? (existingMap.get(u.id)?.base_salary ?? 0),
  }));

  const handleSave = async () => {
    const records = effectiveRows
      .filter((r) => r.input > 0)
      .map((r) => ({
        user_id: r.user_id,
        dept_id: deptId || undefined,
        month,
        base_salary: r.input,
      }));
    if (records.length === 0) { toast.error("Không có dữ liệu để lưu"); return; }
    try {
      await createBatch.mutateAsync(records);
      toast.success(`Lưu lương ${records.length} NV thành công!`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Tháng</label>
          <input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(e.target.value + "-01")}
            className="mt-1 block h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground font-medium">Phòng ban</label>
          <SearchSelect value={deptId} onChange={setDeptId}
            options={[{ value: "", label: "— Chọn PB —" }, ...depts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
            className="mt-1" />
        </div>
        {canManage && deptId && (
          <div className="self-end">
            <Button variant="primary" onClick={handleSave} disabled={createBatch.isPending}>
              {createBatch.isPending ? "Đang lưu..." : "Lưu lương"}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {!deptId ? (
        <EmptyState icon={<Wallet size={32} strokeWidth={1.5} />} title="Chọn phòng ban" subtitle="Chọn 1 PB để nhập lương hàng loạt" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Nhân viên", "Lương hiện tại", "Đã khấu trừ", "Thực nhận", "Lương mới"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {effectiveRows.map((r) => (
                <tr key={r.user_id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.full_name}</td>
                  <td className="px-4 py-2.5 font-mono">{formatVND(r.current)}</td>
                  <td className="px-4 py-2.5 font-mono text-red-400">{r.deduction > 0 ? `-${formatVND(r.deduction)}` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-green-500">{formatVND(r.net)}</td>
                  <td className="px-4 py-2.5">
                    {canManage ? (
                      <input type="number" min={0} value={r.input || ""}
                        onChange={(e) => setRows({ ...rows, [r.user_id]: +e.target.value })}
                        className="w-32 h-7 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
                    ) : <span className="font-mono">{formatVND(r.input)}</span>}
                  </td>
                </tr>
              ))}
              {effectiveRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Không có nhân viên trong phòng ban này</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Danh sách công nợ khoán ──────────────────────────────────────── */

function DeductionsSection() {
  const { data: res } = useSalaryDeductions();
  const deductions = res?.data ?? [];

  if (deductions.length === 0) return <EmptyState icon={<AlertTriangle size={32} strokeWidth={1.5} />} title="Không có công nợ" subtitle="Công nợ phát sinh khi khoán âm (sản lượng < lương)" />;

  const STATUS_STYLE: Record<string, string> = {
    active: "bg-yellow-500/10 text-yellow-600",
    completed: "bg-green-500/10 text-green-600",
    cancelled: "bg-secondary text-muted-foreground",
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {["Nhân viên", "Đợt khoán", "Tổng nợ", "Còn lại", "Trừ/tháng", "Trạng thái"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {deductions.map((d: any) => (
            <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
              <td className="px-4 py-2.5 font-medium">{d.user?.full_name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{d.period?.name ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono text-red-400">{formatVND(d.total_amount)}</td>
              <td className="px-4 py-2.5 font-mono font-bold text-red-500">{formatVND(d.remaining_amount)}</td>
              <td className="px-4 py-2.5 font-mono">{formatVND(d.monthly_deduction)}</td>
              <td className="px-4 py-2.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[d.status]}`}>
                  {{ active: "Đang trừ", completed: "Đã trừ hết", cancelled: "Đã huỷ" }[d.status as string]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
