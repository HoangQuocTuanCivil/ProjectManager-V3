"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useInternalRevenue, useCreateInternalRevenue, useUpdateInternalRevenue, useDeleteInternalRevenue } from "@/lib/hooks/use-revenue";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { Factory } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { InternalRevenueStatus } from "@/lib/types";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", approved: "#3b82f6", recorded: "#10b981",
};

export default function InternalRevenuePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const { data: departments = [] } = useDepartments();
  const canManage = user && ["admin", "leader", "director"].includes(user.role);

  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterDeptId, setFilterDeptId] = useState<string>("");
  const { data: entries = [] } = useInternalRevenue({
    projectId: filterProjectId || undefined,
    deptId: filterDeptId || undefined,
  });
  const create = useCreateInternalRevenue();
  const update = useUpdateInternalRevenue();
  const remove = useDeleteInternalRevenue();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    project_id: "" as string | null, dept_id: "",
    product_name: "", unit_price: 0, quantity: 0,
    status: "pending" as InternalRevenueStatus, period_start: "", period_end: "", notes: "",
  });

  const totalAmount = useMemo(() => entries.reduce((s, e) => s + Number(e.total_amount), 0), [entries]);

  // Group by department
  const deptSummary = useMemo(() => {
    const map = new Map<string, { name: string; code: string; total: number; count: number }>();
    for (const e of entries) {
      const key = e.dept_id;
      if (!map.has(key)) map.set(key, { name: e.department?.name || "", code: e.department?.code || "", total: 0, count: 0 });
      const d = map.get(key)!;
      d.total += Number(e.total_amount);
      d.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  const handleCreate = async () => {
    if (!form.dept_id || !form.product_name || !form.unit_price) { toast.error("Nhập đủ thông tin"); return; }
    try {
      await create.mutateAsync({
        project_id: form.project_id || null,
        dept_id: form.dept_id,
        product_name: form.product_name,
        unit_price: form.unit_price,
        quantity: form.quantity,
        total_amount: Math.round(form.unit_price * form.quantity),
        status: form.status,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      });
      toast.success("Ghi nhận thành công!");
      setShowForm(false);
      setForm({ project_id: "", dept_id: "", product_name: "", unit_price: 0, quantity: 0, status: "pending", period_start: "", period_end: "", notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const statusLabel = (s: string) => (t.revenue as any)[`status${s.charAt(0).toUpperCase() + s.slice(1)}`] || s;

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.revenue.internalSub}</p>

      {/* Summary by department */}
      {deptSummary.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{t.revenue.totalAmount}</p>
            <p className="text-lg font-bold font-mono text-primary">{formatVND(totalAmount)}</p>
          </div>
          {deptSummary.slice(0, 3).map((d) => (
            <div key={d.code} className="bg-card border border-border rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground">{d.code} — {d.name}</p>
              <p className="text-sm font-bold font-mono">{formatVND(d.total)}</p>
              <p className="text-[10px] text-muted-foreground">{d.count} sản phẩm</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + Action */}
      <div className="flex items-center gap-3">
        <div className="w-52">
          <SearchSelect value={filterProjectId} onChange={setFilterProjectId}
            options={[{ value: "", label: t.revenue.allProjects }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
            placeholder={t.revenue.selectProject} />
        </div>
        <div className="w-52">
          <SearchSelect value={filterDeptId} onChange={setFilterDeptId}
            options={[{ value: "", label: t.revenue.allDepts }, ...departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
            placeholder={t.revenue.selectDept} />
        </div>
        <div className="flex-1" />
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t.common.cancel : t.revenue.newInternal}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && canManage && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.revenue.newInternal}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectDept} *</label>
              <SearchSelect value={form.dept_id} onChange={(v) => setForm({ ...form, dept_id: v })}
                options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                placeholder={t.revenue.selectDept} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.selectProject}</label>
              <SearchSelect value={form.project_id || ""} onChange={(v) => setForm({ ...form, project_id: v || null })}
                options={[{ value: "", label: "—" }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
                className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.productName} *</label>
              <input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="Bản vẽ TKCS cầu..." className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.unitPrice} *</label>
              <input type="number" min={0} value={form.unit_price || ""} onChange={(e) => setForm({ ...form, unit_price: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.quantity} *</label>
              <input type="number" min={0} step={0.01} value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.totalAmount}</label>
              <p className="mt-1 h-9 flex items-center px-3 rounded-lg bg-secondary/50 text-base font-mono font-bold text-primary">{formatVND(Math.round(form.unit_price * form.quantity))}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodStart}</label>
              <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.periodEnd}</label>
              <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.revenue.notes}</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? t.revenue.creating : t.revenue.create}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState icon={<Factory size={32} strokeWidth={1.5} />} title={t.revenue.noInternal} subtitle={t.revenue.noInternalSub} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectDept}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.productName}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.unitPrice}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.quantity}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.totalAmount}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.contracts.status}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.selectProject}</th>
                {canManage && <th className="text-right px-4 py-2.5 font-medium w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {entries.map((e) => {
                const color = STATUS_COLORS[e.status] || "#94a3b8";
                return (
                  <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{e.department?.code} — {e.department?.name}</td>
                    <td className="px-4 py-2.5">{e.product_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatVND(Number(e.unit_price))}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(e.quantity)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(e.total_amount))}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        {statusLabel(e.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.project?.code || "—"}</td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right space-x-2">
                        {e.status === "pending" && (
                          <button onClick={() => update.mutate({ id: e.id, status: "approved" })} className="text-[10px] text-primary hover:underline">{t.revenue.markApproved}</button>
                        )}
                        {e.status === "approved" && (
                          <button onClick={() => update.mutate({ id: e.id, status: "recorded" })} className="text-[10px] text-primary hover:underline">{t.revenue.markRecorded}</button>
                        )}
                        <button onClick={() => { if (confirm(t.revenue.confirmDeleteInternal)) remove.mutate(e.id); }} className="text-destructive hover:underline text-[10px]">{t.common.delete}</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/20">
                <td colSpan={4} className="px-4 py-2 font-bold">{t.revenue.totalAmount}</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-primary">{formatVND(totalAmount)}</td>
                <td colSpan={canManage ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
