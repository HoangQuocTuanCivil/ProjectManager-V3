"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useDeptBudgetAllocations, useUpsertDeptBudgetAllocation, useDeleteDeptBudgetAllocation } from "@/lib/hooks/use-kpi";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { Coins } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code, center_id")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function useCenters() {
  return useQuery({
    queryKey: ["centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

type AssignTarget = "dept" | "center";

export default function BudgetAssignPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const { data: contracts = [] } = useContracts();
  const { data: departments = [] } = useDepartments();
  const { data: centers = [] } = useCenters();
  const [filterProjectId, setFilterProjectId] = useState<string>("all");

  // Quỹ khoán = tổng giá trị hợp đồng active/completed per dự án
  const projectContractFund = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts) {
      if (!c.project_id || !["active", "completed"].includes(c.status)) continue;
      map.set(c.project_id, (map.get(c.project_id) || 0) + Number(c.contract_value || 0));
    }
    return map;
  }, [contracts]);

  const { data: allocations = [] } = useDeptBudgetAllocations(
    filterProjectId !== "all" ? filterProjectId : undefined,
  );
  const upsert = useUpsertDeptBudgetAllocation();
  const remove = useDeleteDeptBudgetAllocation();

  const canManage = user && ["admin", "leader", "director"].includes(user.role);
  // Dept heads only see their own department (RLS enforces this server-side too)
  const isDeptScoped = user && !["admin", "leader", "director"].includes(user.role);

  // Form state — hỗ trợ giao cho trung tâm hoặc phòng ban
  const [showForm, setShowForm] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget>("dept");
  const [form, setForm] = useState({ project_id: "", contract_id: "", dept_id: "", center_id: "", allocated_amount: 0, delivery_progress: 0, note: "" });

  const selectedProject = projects.find((p: any) => p.id === form.project_id);

  const projectContracts = useMemo(() => {
    if (!form.project_id) return [];
    return contracts.filter((c: any) =>
      c.project_id === form.project_id &&
      c.contract_type === "outgoing" &&
      ["active", "completed"].includes(c.status)
    );
  }, [contracts, form.project_id]);

  // Summary: total assigned for selected project
  const projectAllocations = useMemo(() => {
    if (!form.project_id) return [];
    let list = allocations.filter((a) => a.project_id === form.project_id);
    if (form.contract_id) list = list.filter((a) => a.contract_id === form.contract_id);
    return list;
  }, [allocations, form.project_id, form.contract_id]);
  const totalAssigned = projectAllocations.reduce((s, a) => s + Number(a.allocated_amount), 0);

  const fund = useMemo(() => {
    if (form.contract_id) {
      const c = contracts.find((c: any) => c.id === form.contract_id);
      return c ? Number(c.contract_value) : 0;
    }
    return projectContractFund.get(form.project_id) || 0;
  }, [form.project_id, form.contract_id, contracts, projectContractFund]);

  const handleSubmit = async () => {
    if (!form.project_id) { toast.error("Vui lòng chọn dự án"); return; }
    if (assignTarget === "dept" && !form.dept_id) { toast.error("Vui lòng chọn phòng ban"); return; }
    if (assignTarget === "center" && !form.center_id) { toast.error("Vui lòng chọn trung tâm"); return; }
    if (form.allocated_amount <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    try {
      await upsert.mutateAsync({
        project_id: form.project_id,
        contract_id: form.contract_id || undefined,
        dept_id: assignTarget === "dept" ? form.dept_id : "",
        center_id: assignTarget === "center" ? form.center_id : undefined,
        allocated_amount: form.allocated_amount,
        delivery_progress: form.delivery_progress || 0,
        note: form.note || undefined,
      });
      toast.success("Giao khoán thành công!");
      setForm({ project_id: form.project_id, contract_id: "", dept_id: "", center_id: "", allocated_amount: 0, delivery_progress: 0, note: "" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi giao khoán");
    }
  };

  // Group allocations by project for display
  const groupedByProject = useMemo(() => {
    const map = new Map<string, typeof allocations>();
    for (const a of allocations) {
      const key = a.project_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([projectId, items]) => ({
      projectId,
      project: items[0]?.project,
      items,
      total: items.reduce((s, i) => s + Number(i.allocated_amount), 0),
    }));
  }, [allocations]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{t.kpi.budgetAssignSub}</p>
      </div>

      {/* Filter + Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-64">
          <SearchSelect
            value={filterProjectId}
            onChange={setFilterProjectId}
            options={[
              { value: "all", label: t.kpi.allProjects },
              ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
            ]}
            placeholder={t.kpi.selectProject}
          />
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t.common.cancel : `+ ${t.kpi.budgetAssignTab}`}
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && canManage && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.kpi.budgetAssignTitle}</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.project}</label>
              <SearchSelect
                value={form.project_id}
                onChange={(val) => setForm({ ...form, project_id: val, contract_id: "", dept_id: "", allocated_amount: 0 })}
                options={projects.map((p: any) => ({
                  value: p.id,
                  label: `${p.code} — ${p.name} (${formatVND(projectContractFund.get(p.id) || 0)})`,
                }))}
                placeholder={t.kpi.selectProject}
                className="mt-1"
              />
            </div>

            {/* Hợp đồng đầu ra */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">Hợp đồng</label>
              <SearchSelect
                value={form.contract_id}
                onChange={(val) => setForm({ ...form, contract_id: val })}
                options={[
                  { value: "", label: "— Theo dự án (không chọn HĐ) —" },
                  ...projectContracts.map((c: any) => ({
                    value: c.id,
                    label: `${c.contract_no} — ${c.title} (${formatVND(Number(c.contract_value))})`,
                  })),
                ]}
                placeholder="Chọn hợp đồng"
                className="mt-1"
              />
            </div>

            {/* Giao cho: Trung tâm hoặc Phòng ban */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">Giao cho</label>
              <div className="flex items-center gap-1 mt-1 mb-2">
                {(["center", "dept"] as const).map((t) => (
                  <button key={t} onClick={() => { setAssignTarget(t); setForm({ ...form, dept_id: "", center_id: "" }); }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${assignTarget === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    {t === "center" ? "Trung tâm" : "Phòng ban"}
                  </button>
                ))}
              </div>
              {assignTarget === "dept" ? (
                <SearchSelect
                  value={form.dept_id}
                  onChange={(val) => setForm({ ...form, dept_id: val })}
                  options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                  placeholder="Chọn phòng ban"
                />
              ) : (
                <SearchSelect
                  value={form.center_id}
                  onChange={(val) => setForm({ ...form, center_id: val })}
                  options={(centers ?? []).map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))}
                  placeholder="Chọn trung tâm"
                />
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.allocatedAmount}</label>
              <input
                type="number"
                min={0}
                value={form.allocated_amount || ""}
                onChange={(e) => setForm({ ...form, allocated_amount: +e.target.value })}
                placeholder="500000000"
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
              />
            </div>

            {/* Delivery Progress */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.deliveryProgress}</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.delivery_progress || ""}
                onChange={(e) => setForm({ ...form, delivery_progress: +e.target.value })}
                placeholder="0"
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-sm text-muted-foreground font-medium">{t.kpi.note}</label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={t.kpi.notePlaceholder}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Budget summary bar */}
          {selectedProject && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.kpi.allocationFund}: <span className="font-semibold text-foreground">{formatVND(fund)}</span></span>
                <span className="text-muted-foreground">{t.kpi.totalAssigned}: <span className="font-semibold text-foreground">{formatVND(totalAssigned)}</span></span>
                <span className="text-muted-foreground">{t.kpi.remaining}: <span className={`font-semibold ${fund - totalAssigned < 0 ? "text-destructive" : "text-primary"}`}>{formatVND(fund - totalAssigned)}</span></span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${fund > 0 && totalAssigned > fund ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min((totalAssigned / (fund || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending ? t.kpi.assigning : t.kpi.assignBudget}
            </Button>
          </div>
        </div>
      )}

      {/* Allocation List */}
      {groupedByProject.length === 0 ? (
        <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title={t.kpi.noBudgetAssign} subtitle={t.kpi.noBudgetAssignSub} />
      ) : (
        <div className="space-y-5">
          {groupedByProject.map(({ projectId, project, items, total }) => {
            const projFund = projectContractFund.get(projectId) || 0;
            return (
              <div key={projectId} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Project header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">
                        {project?.code} — {project?.name}
                      </h4>
                      {/* Full budget info only for managers */}
                      {!isDeptScoped ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t.kpi.allocationFund}: {formatVND(projFund)}
                          {" · "}
                          {t.kpi.totalAssigned}: {formatVND(total)}
                          {" · "}
                          {t.kpi.remaining}: <span className={total > projFund ? "text-destructive font-semibold" : "text-primary font-semibold"}>{formatVND(projFund - total)}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t.kpi.budgetAssignTab}
                        </p>
                      )}
                    </div>
                    {!isDeptScoped && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{items.length} {t.kpi.deptName}</div>
                        <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${total > projFund ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${Math.min((total / (projFund || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">{t.kpi.deptName}</th>
                      <th className="text-left px-4 py-2 font-medium">Hợp đồng</th>
                      <th className="text-right px-4 py-2 font-medium">{t.kpi.amount}</th>
                      {!isDeptScoped && <th className="text-right px-4 py-2 font-medium">%</th>}
                      <th className="text-right px-4 py-2 font-medium">{t.kpi.deliveryProgress}</th>
                      <th className="text-left px-4 py-2 font-medium">{t.kpi.note}</th>
                      {canManage && <th className="text-right px-4 py-2 font-medium w-20">{t.kpi.actions}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {items.map((a) => (
                      <tr key={a.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium">
                          {(a as any).center?.name
                            ? <><span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] mr-1">TT</span>{(a as any).center.code || (a as any).center.name}</>
                            : <>{a.department?.code && <span className="text-muted-foreground mr-1">{a.department.code}</span>}{a.department?.name}</>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">
                          {(a as any).contract
                            ? <span className="font-mono text-xs">{(a as any).contract.contract_no}</span>
                            : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(a.allocated_amount))}</td>
                        {!isDeptScoped && (
                          <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                            {projFund > 0 ? ((Number(a.allocated_amount) / projFund) * 100).toFixed(1) : "—"}%
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(Number(a.delivery_progress) || 0, 100)}%` }} />
                            </div>
                            <span className="font-mono text-muted-foreground">{(Number(a.delivery_progress) || 0).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{a.note || "—"}</td>
                        {canManage && (
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => {
                                if (confirm(t.kpi.confirmDeleteBudget.replace("{dept}", a.department?.name || ""))) {
                                  remove.mutate(a.id);
                                }
                              }}
                              className="text-destructive hover:underline text-[11px]"
                              disabled={remove.isPending}
                            >
                              {t.common.delete}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {!isDeptScoped && (
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/20">
                        <td className="px-4 py-2 font-bold">{t.kpi.totalAssigned}</td>
                        <td />
                        <td className="px-4 py-2 text-right font-mono font-bold">{formatVND(total)}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">
                          {projFund > 0 ? ((total / projFund) * 100).toFixed(1) : "—"}%
                        </td>
                        <td />
                        <td colSpan={canManage ? 2 : 1} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
