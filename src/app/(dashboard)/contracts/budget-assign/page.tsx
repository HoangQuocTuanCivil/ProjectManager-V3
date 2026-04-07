"use client";

import { useState, useMemo } from "react";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useDeptBudgetAllocations, useUpsertDeptBudgetAllocation, useDeleteDeptBudgetAllocation } from "@/lib/hooks/use-kpi";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { Coins } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/kpi";
import { formatDate } from "@/lib/utils/format";
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
  const { data: contracts = [] } = useContracts();
  const { data: departments = [] } = useDepartments();
  const { data: centers = [] } = useCenters();
  const [filterContractId, setFilterContractId] = useState<string>("all");

  // Danh sách hợp đồng đầu ra đang hoạt động — dùng cho cả filter lẫn form
  const activeContracts = useMemo(() =>
    contracts.filter((c: any) => c.contract_type === "outgoing" && ["active", "completed"].includes(c.status)),
    [contracts]
  );

  const { data: allocations = [] } = useDeptBudgetAllocations(
    // Lọc theo project_id của hợp đồng được chọn
    filterContractId !== "all"
      ? activeContracts.find((c: any) => c.id === filterContractId)?.project_id
      : undefined,
  );
  const upsert = useUpsertDeptBudgetAllocation();
  const remove = useDeleteDeptBudgetAllocation();

  const canManage = user && ["admin", "leader", "director"].includes(user.role);
  const isDeptScoped = user && !["admin", "leader", "director"].includes(user.role);

  // Form state — giao khoán theo hợp đồng
  const [showForm, setShowForm] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget>("center");
  const [form, setForm] = useState({
    contract_id: "", dept_id: "", center_id: "",
    allocated_amount: 0, delivery_date: "", note: "",
  });

  // Hợp đồng được chọn trong form → lấy giá trị và project_id
  const selectedContract = activeContracts.find((c: any) => c.id === form.contract_id);
  const contractValue = selectedContract ? Number(selectedContract.contract_value) : 0;

  // Tổng đã giao khoán cho hợp đồng đang chọn
  const contractAllocations = useMemo(() => {
    if (!form.contract_id) return [];
    return allocations.filter((a) => a.contract_id === form.contract_id);
  }, [allocations, form.contract_id]);
  const totalAssigned = contractAllocations.reduce((s, a) => s + Number(a.allocated_amount), 0);

  const handleSubmit = async () => {
    if (!form.contract_id) { toast.error("Vui lòng chọn hợp đồng"); return; }
    if (assignTarget === "dept" && !form.dept_id) { toast.error("Vui lòng chọn phòng ban"); return; }
    if (assignTarget === "center" && !form.center_id) { toast.error("Vui lòng chọn trung tâm"); return; }
    if (form.allocated_amount <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    try {
      await upsert.mutateAsync({
        project_id: selectedContract?.project_id || "",
        contract_id: form.contract_id,
        dept_id: assignTarget === "dept" ? form.dept_id : "",
        center_id: assignTarget === "center" ? form.center_id : undefined,
        allocated_amount: form.allocated_amount,
        delivery_date: form.delivery_date || undefined,
        note: form.note || undefined,
      });
      toast.success("Giao khoán thành công!");
      setForm({ ...form, dept_id: "", center_id: "", allocated_amount: 0, delivery_date: "", note: "" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi giao khoán");
    }
  };

  // Nhóm giao khoán theo hợp đồng
  const groupedByContract = useMemo(() => {
    // Lọc theo hợp đồng nếu đã chọn filter
    const filtered = filterContractId !== "all"
      ? allocations.filter((a) => a.contract_id === filterContractId)
      : allocations;

    const map = new Map<string, typeof allocations>();
    for (const a of filtered) {
      const key = a.contract_id || a.project_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([contractId, items]) => ({
      contractId,
      contract: (items[0] as any).contract,
      project: items[0]?.project,
      items,
      total: items.reduce((s, i) => s + Number(i.allocated_amount), 0),
    }));
  }, [allocations, filterContractId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-sm text-muted-foreground">{t.kpi.budgetAssignSub}</p>
      </div>

      {/* Lọc theo hợp đồng + nút tạo mới */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-72">
          <SearchSelect
            value={filterContractId}
            onChange={setFilterContractId}
            options={[
              { value: "all", label: "Tất cả hợp đồng" },
              ...activeContracts.map((c: any) => ({
                value: c.id,
                label: `${c.contract_no} — ${c.title}`,
                sublabel: formatVND(Number(c.contract_value)),
              })),
            ]}
            placeholder="Lọc theo hợp đồng"
          />
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            {`+ ${t.kpi.budgetAssignTab}`}
          </Button>
        )}
      </div>

      {/* Modal giao khoán — layout theo thiết kế */}
      {showForm && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tiêu đề */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-primary">{t.kpi.budgetAssignTitle}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>

            {/* Nội dung form — 2 cột */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Hàng 1: Hợp đồng + Giao cho (TT/PB) */}
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Hợp đồng</label>
                  <SearchSelect
                    value={form.contract_id}
                    onChange={(val) => setForm({ ...form, contract_id: val, dept_id: "", center_id: "", allocated_amount: 0 })}
                    options={activeContracts.map((c: any) => ({
                      value: c.id,
                      label: `${c.contract_no} — ${c.title}`,
                      sublabel: formatVND(Number(c.contract_value)),
                    }))}
                    placeholder="Chọn hợp đồng"
                    className="mt-1"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground font-medium">Giao cho</label>
                    <div className="flex items-center gap-1 ml-auto">
                      {(["center", "dept"] as const).map((v) => (
                        <button key={v} onClick={() => { setAssignTarget(v); setForm({ ...form, dept_id: "", center_id: "" }); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${assignTarget === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                          {v === "center" ? "Trung tâm" : "Phòng ban"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {assignTarget === "center" ? (
                    <SearchSelect
                      value={form.center_id}
                      onChange={(val) => setForm({ ...form, center_id: val })}
                      options={(centers ?? []).map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))}
                      placeholder="Chọn trung tâm"
                      className="mt-1"
                    />
                  ) : (
                    <SearchSelect
                      value={form.dept_id}
                      onChange={(val) => setForm({ ...form, dept_id: val })}
                      options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                      placeholder="Chọn phòng ban"
                      className="mt-1"
                    />
                  )}
                </div>

                {/* Hàng 2: Số tiền + Ngày hoàn thành */}
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.kpi.allocatedAmount}</label>
                  <input
                    type="number" min={0}
                    value={form.allocated_amount || ""}
                    onChange={(e) => setForm({ ...form, allocated_amount: +e.target.value })}
                    placeholder="500000000"
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Tiến độ giao</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Hàng 3: Ghi chú (full width) */}
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground font-medium">{t.kpi.note}</label>
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder={t.kpi.notePlaceholder}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Thanh tổng hợp ngân sách — hiện khi đã chọn hợp đồng */}
              {selectedContract && (
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Giá trị HĐ: <span className="font-semibold text-foreground">{formatVND(contractValue)}</span></span>
                    <span className="text-muted-foreground">{t.kpi.totalAssigned}: <span className="font-semibold text-foreground">{formatVND(totalAssigned)}</span></span>
                    <span className="text-muted-foreground">{t.kpi.remaining}: <span className={`font-semibold ${contractValue - totalAssigned < 0 ? "text-destructive" : "text-primary"}`}>{formatVND(contractValue - totalAssigned)}</span></span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${contractValue > 0 && totalAssigned > contractValue ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min((totalAssigned / (contractValue || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={upsert.isPending}>
                {upsert.isPending ? t.kpi.assigning : t.kpi.assignBudget}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Danh sách giao khoán — nhóm theo hợp đồng */}
      {groupedByContract.length === 0 ? (
        <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title={t.kpi.noBudgetAssign} subtitle={t.kpi.noBudgetAssignSub} />
      ) : (
        <div className="space-y-5">
          {groupedByContract.map(({ contractId, contract, project, items, total }) => {
            const ctValue = contract ? Number(contract.contract_value || 0) : 0;
            return (
              <div key={contractId} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header hợp đồng */}
                <div className="px-4 py-3 border-b border-border bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">
                        {contract ? `${contract.contract_no} — ${contract.title}` : project?.code}
                      </h4>
                      {!isDeptScoped && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Giá trị HĐ: {formatVND(ctValue)}
                          {" · "}Đã giao: {formatVND(total)}
                          {" · "}Còn lại: <span className={total > ctValue ? "text-destructive font-semibold" : "text-primary font-semibold"}>{formatVND(ctValue - total)}</span>
                          {project && <span className="ml-2 text-muted-foreground/60">DA: {project.code}</span>}
                        </p>
                      )}
                    </div>
                    {!isDeptScoped && ctValue > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{items.length} phân bổ</div>
                        <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${total > ctValue ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${Math.min((total / (ctValue || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bảng chi tiết */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">{t.kpi.deptName}</th>
                      <th className="text-right px-4 py-2 font-medium">{t.kpi.amount}</th>
                      {!isDeptScoped && <th className="text-right px-4 py-2 font-medium">%</th>}
                      <th className="text-left px-4 py-2 font-medium">Ngày hoàn thành</th>
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
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(a.allocated_amount))}</td>
                        {!isDeptScoped && (
                          <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                            {ctValue > 0 ? ((Number(a.allocated_amount) / ctValue) * 100).toFixed(1) : "—"}%
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {(a as any).delivery_date ? formatDate((a as any).delivery_date) : "—"}
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
                        <td className="px-4 py-2 text-right font-mono font-bold">{formatVND(total)}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">
                          {ctValue > 0 ? ((total / ctValue) * 100).toFixed(1) : "—"}%
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
