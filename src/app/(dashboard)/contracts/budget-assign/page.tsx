"use client";

import { useState, useMemo, useRef, Fragment } from "react";
import { useContracts } from "@/features/contracts";
import { useDeptBudgetAllocations, useUpsertDeptBudgetAllocation, useUpdateDeptBudgetAllocation, useDeleteDeptBudgetAllocation, useAcceptanceRounds, useUpsertAcceptanceRound, useDeleteAcceptanceRound } from "@/features/kpi";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState, ConfirmDialog } from "@/components/shared";
import { Coins, FileText, Upload, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/kpi";
import { formatDate } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DeptBudgetAllocation, AcceptanceRound } from "@/lib/types";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments").select("id, name, code, center_id")
        .eq("is_active", true).order("sort_order");
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
        .from("centers").select("id, name, code")
        .eq("is_active", true).order("sort_order");
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

  // Hợp đồng đầu ra có thể phân bổ giao khoán
  const activeContracts = useMemo(() =>
    contracts.filter((c: any) => c.contract_type === "outgoing" && ["draft", "active", "completed"].includes(c.status)),
    [contracts]
  );

  const { data: allocations = [] } = useDeptBudgetAllocations(
    filterContractId !== "all"
      ? activeContracts.find((c: any) => c.id === filterContractId)?.project_id
      : undefined,
  );
  const upsert = useUpsertDeptBudgetAllocation();
  const update = useUpdateDeptBudgetAllocation();
  const remove = useDeleteDeptBudgetAllocation();

  const canManage = !!user;
  const isDeptScoped = user && !["admin", "leader", "director"].includes(user.role);

  /* ─── Nghiệm thu: fetch tất cả rounds, nhóm theo allocation_id ── */
  const allocationIds = useMemo(() => allocations.map((a) => a.id), [allocations]);
  const { data: allRounds = [] } = useAcceptanceRounds(allocationIds);
  const upsertRound = useUpsertAcceptanceRound();
  const removeRound = useDeleteAcceptanceRound();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingRound, setEditingRound] = useState<AcceptanceRound | null>(null);

  const roundsByAllocation = useMemo(() => {
    const map = new Map<string, AcceptanceRound[]>();
    for (const r of allRounds) {
      const list = map.get(r.allocation_id) || [];
      list.push(r);
      map.set(r.allocation_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [allRounds]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  /* ─── Summary: tổng giá trị HĐ + tổng giao khoán ────────────── */
  const summary = useMemo(() => {
    const filtered = filterContractId !== "all"
      ? allocations.filter((a) => a.contract_id === filterContractId)
      : allocations;

    // Tổng giá trị các HĐ đã giao khoán (dedupe theo contract_id)
    const contractMap = new Map<string, number>();
    for (const a of filtered) {
      if (a.contract_id && a.contract?.contract_value && !contractMap.has(a.contract_id)) {
        contractMap.set(a.contract_id, Number(a.contract.contract_value));
      }
    }
    const totalContractValue = Array.from(contractMap.values()).reduce((s, v) => s + v, 0);
    const totalAllocated = filtered.reduce((s, a) => s + Number(a.allocated_amount), 0);

    return { totalContractValue, totalAllocated };
  }, [allocations, filterContractId]);

  /* ─── Popup xác nhận xóa / chỉnh sửa giao khoán ──────────────── */
  const [deleteTarget, setDeleteTarget] = useState<DeptBudgetAllocation | null>(null);
  const [editTarget, setEditTarget] = useState<DeptBudgetAllocation | null>(null);

  /* ─── Form state ──────────────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget>("center");
  const [form, setForm] = useState({
    contract_id: "", dept_id: "", center_id: "",
    allocated_amount: 0,
    start_date: "", end_date: "",
    allocation_code: "", note: "",
  });
  const [taskDocFile, setTaskDocFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedContract = activeContracts.find((c: any) => c.id === form.contract_id);
  const contractValue = selectedContract ? Number(selectedContract.contract_value) : 0;

  // Tổng đã giao cho HĐ đang chọn
  const contractAllocations = useMemo(() => {
    if (!form.contract_id) return [];
    return allocations.filter((a) => a.contract_id === form.contract_id);
  }, [allocations, form.contract_id]);
  const totalAssigned = contractAllocations.reduce((s, a) => s + Number(a.allocated_amount), 0);

  // Upload PDF phiếu giao nhiệm vụ vào Supabase Storage
  const uploadTaskDoc = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `budget-allocations/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("contract-files").upload(path, file, { cacheControl: "3600" });
    if (error) { toast.error("Lỗi upload file: " + error.message); return null; }
    return path;
  };

  const handleSubmit = async () => {
    if (!form.contract_id) { toast.error("Vui lòng chọn hợp đồng"); return; }
    if (assignTarget === "dept" && !form.dept_id) { toast.error("Vui lòng chọn phòng ban"); return; }
    if (assignTarget === "center" && !form.center_id) { toast.error("Vui lòng chọn trung tâm"); return; }
    if (form.allocated_amount <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    try {
      let taskDocUrl: string | undefined;
      if (taskDocFile) {
        const url = await uploadTaskDoc(taskDocFile);
        if (!url) return;
        taskDocUrl = url;
      }
      await upsert.mutateAsync({
        project_id: selectedContract?.project_id || "",
        contract_id: form.contract_id,
        dept_id: assignTarget === "dept" ? form.dept_id : "",
        center_id: assignTarget === "center" ? form.center_id : undefined,
        allocated_amount: form.allocated_amount,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        allocation_code: form.allocation_code || undefined,
        task_document_url: taskDocUrl,
        note: form.note || undefined,
      });
      toast.success("Giao khoán thành công!");
      setForm({ ...form, dept_id: "", center_id: "", allocated_amount: 0, start_date: "", end_date: "", allocation_code: "", note: "" });
      setTaskDocFile(null);
    } catch (e: any) {
      toast.error(e.message || "Lỗi giao khoán");
    }
  };

  /* ─── Nhóm giao khoán theo Trung tâm ─────────────────────────── */
  const groupedByCenter = useMemo(() => {
    const filtered = filterContractId !== "all"
      ? allocations.filter((a) => a.contract_id === filterContractId)
      : allocations;

    const map = new Map<string, { center: DeptBudgetAllocation["center"]; items: DeptBudgetAllocation[]; total: number }>();

    for (const a of filtered) {
      const centerId = a.center_id || "no-center";
      if (!map.has(centerId)) {
        map.set(centerId, { center: a.center || undefined, items: [], total: 0 });
      }
      const group = map.get(centerId)!;
      group.items.push(a);
      group.total += Number(a.allocated_amount);
    }

    return Array.from(map.entries())
      .map(([id, data]) => ({ centerId: id, ...data }))
      .sort((a, b) => (a.center?.code || "zzz").localeCompare(b.center?.code || "zzz"));
  }, [allocations, filterContractId]);

  // Tải PDF phiếu giao nhiệm vụ từ Storage
  const handleViewDoc = async (path: string) => {
    const { data } = await supabase.storage.from("contract-files").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Không thể tải file");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.kpi.budgetAssignSub}</p>

      {/* ─── Dashboard: 2 thẻ tổng hợp ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={15} className="text-primary" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">Tổng giá trị hợp đồng</span>
          </div>
          <p className="text-lg font-bold font-mono text-primary">{formatVND(summary.totalContractValue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Coins size={15} className="text-emerald-500" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">Tổng giá trị giao khoán</span>
          </div>
          <p className="text-lg font-bold font-mono text-emerald-500">{formatVND(summary.totalAllocated)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {summary.totalContractValue > 0
              ? `${((summary.totalAllocated / summary.totalContractValue) * 100).toFixed(1)}% giá trị HĐ`
              : "—"}
          </p>
        </div>
      </div>

      {/* ─── Filter + Action ─── */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-72">
          <SearchSelect
            value={filterContractId} onChange={setFilterContractId}
            options={[
              { value: "all", label: "Tất cả hợp đồng" },
              ...activeContracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}`, sublabel: formatVND(Number(c.contract_value)) })),
            ]}
            placeholder="Lọc theo hợp đồng"
          />
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + {t.kpi.budgetAssignTab}
          </Button>
        )}
      </div>

      {/* ─── Modal tạo giao khoán ─── */}
      {showForm && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
              <h3 className="text-base font-bold text-primary">{t.kpi.budgetAssignTitle}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Hàng 1: Hợp đồng + Giao cho */}
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Hợp đồng</label>
                  <SearchSelect
                    value={form.contract_id}
                    onChange={(val) => setForm({ ...form, contract_id: val, dept_id: "", center_id: "", allocated_amount: 0 })}
                    options={activeContracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}`, sublabel: formatVND(Number(c.contract_value)) }))}
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
                    <SearchSelect value={form.center_id} onChange={(val) => setForm({ ...form, center_id: val })}
                      options={(centers ?? []).map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))}
                      placeholder="Chọn trung tâm" className="mt-1" />
                  ) : (
                    <SearchSelect value={form.dept_id} onChange={(val) => setForm({ ...form, dept_id: val })}
                      options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                      placeholder="Chọn phòng ban" className="mt-1" />
                  )}
                </div>

                {/* Hàng 2: Mã HĐ giao khoán + Phiếu giao nhiệm vụ */}
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Mã HĐ giao khoán</label>
                  <input
                    value={form.allocation_code}
                    onChange={(e) => setForm({ ...form, allocation_code: e.target.value })}
                    placeholder="VD: GK-2026-001"
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">
                    Phiếu giao nhiệm vụ <span className="text-muted-foreground/50 font-normal">(tuỳ chọn)</span>
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-9 px-3 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Upload size={14} />
                      {taskDocFile ? taskDocFile.name : "Chọn file PDF"}
                    </button>
                    {taskDocFile && (
                      <button onClick={() => setTaskDocFile(null)} className="text-xs text-destructive hover:underline">Xoá</button>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) setTaskDocFile(e.target.files[0]); e.target.value = ""; }} />
                  </div>
                </div>

                {/* Hàng 3: Số tiền + Ngày bắt đầu + Ngày kết thúc */}
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground font-medium">{t.kpi.allocatedAmount}</label>
                  <input type="number" min={0} value={form.allocated_amount || ""} onChange={(e) => setForm({ ...form, allocated_amount: +e.target.value })}
                    placeholder="500000000" className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
                </div>

                {/* Hàng 4: Ngày bắt đầu + Ngày kết thúc */}
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Ngày bắt đầu</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Ngày kết thúc</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>

                {/* Hàng 5: Ghi chú */}
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground font-medium">{t.kpi.note}</label>
                  <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder={t.kpi.notePlaceholder} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
              </div>

              {/* Thanh tổng hợp ngân sách */}
              {selectedContract && (
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Giá trị HĐ: <span className="font-semibold text-foreground">{formatVND(contractValue)}</span></span>
                    <span className="text-muted-foreground">{t.kpi.totalAssigned}: <span className="font-semibold text-foreground">{formatVND(totalAssigned)}</span></span>
                    <span className="text-muted-foreground">{t.kpi.remaining}: <span className={`font-semibold ${contractValue - totalAssigned < 0 ? "text-destructive" : "text-primary"}`}>{formatVND(contractValue - totalAssigned)}</span></span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${contractValue > 0 && totalAssigned > contractValue ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min((totalAssigned / (contractValue || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={upsert.isPending}>
                {upsert.isPending ? t.kpi.assigning : t.kpi.assignBudget}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Popup xác nhận xóa giao khoán ─── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Xóa giao khoán"
        description={deleteTarget
          ? `Giao khoán ${deleteTarget.allocation_code || ""} cho ${deleteTarget.center?.name || deleteTarget.department?.name || "—"} (${formatVND(Number(deleteTarget.allocated_amount))}) sẽ bị xóa.\n\nHĐ đầu vào liên quan cũng sẽ bị xóa.`
          : ""}
        confirmLabel="Xóa"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />

      {/* ─── Modal chỉnh sửa giao khoán ─── */}
      {editTarget && canManage && (
        <EditAllocationModal
          allocation={editTarget}
          centers={centers ?? []}
          departments={departments}
          onClose={() => setEditTarget(null)}
          onSave={update.mutateAsync}
          isPending={update.isPending}
        />
      )}

      {/* ─── Danh sách giao khoán — nhóm theo Trung tâm ─── */}
      {/* Popup sửa đợt nghiệm thu */}
      {editingRound && (
        <EditRoundModal round={editingRound} onClose={() => setEditingRound(null)} onSave={upsertRound.mutateAsync} isPending={upsertRound.isPending} />
      )}

      {groupedByCenter.length === 0 ? (
        <EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title={t.kpi.noBudgetAssign} subtitle={t.kpi.noBudgetAssignSub} />
      ) : (
        <div className="space-y-5">
          {groupedByCenter.map(({ centerId, center, items, total }) => (
            <div key={centerId} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header trung tâm */}
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold">
                      {center ? `${center.code || ""} — ${center.name}` : "Chưa phân trung tâm"}
                    </h4>
                    {!isDeptScoped && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {items.length} giao khoán · Tổng: <span className="font-semibold text-foreground">{formatVND(total)}</span>
                      </p>
                    )}
                  </div>
                  {!isDeptScoped && (
                    <p className="text-base font-bold font-mono text-primary">{formatVND(total)}</p>
                  )}
                </div>
              </div>

              {/* Bảng chi tiết */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Hợp đồng</th>
                    <th className="text-left px-4 py-2 font-medium">Mã GK</th>
                    <th className="text-left px-4 py-2 font-medium">{t.kpi.deptName}</th>
                    <th className="text-right px-4 py-2 font-medium">{t.kpi.amount}</th>
                    <th className="text-left px-4 py-2 font-medium">Bắt đầu</th>
                    <th className="text-left px-4 py-2 font-medium">Kết thúc</th>
                    <th className="text-left px-4 py-2 font-medium">Phiếu GNV</th>
                    <th className="text-left px-4 py-2 font-medium">{t.kpi.note}</th>
                    {canManage && <th className="text-right px-4 py-2 font-medium w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const rounds = roundsByAllocation.get(a.id) || [];
                    const isExpanded = expandedRows.has(a.id);
                    const totalAccepted = rounds.reduce((s, r) => s + Number(r.amount), 0);
                    const colCount = canManage ? 9 : 8;

                    return (
                      <Fragment key={a.id}>
                        {/* Dòng giao khoán chính */}
                        <tr className="hover:bg-secondary/20 transition-colors border-b border-border/30">
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => toggleExpand(a.id)} className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors">
                                <ChevronRight size={13} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                              {a.contract ? <span className="font-mono text-xs">{a.contract.contract_no}</span> : "—"}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">{a.allocation_code || "—"}</td>
                          <td className="px-4 py-2.5 font-medium">
                            {a.department ? <>{a.department.code && <span className="text-muted-foreground mr-1">{a.department.code}</span>}{a.department.name}</> : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatVND(Number(a.allocated_amount))}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{a.start_date ? formatDate(a.start_date) : "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{a.end_date ? formatDate(a.end_date) : "—"}</td>
                          <td className="px-4 py-2.5">
                            {a.task_document_url ? (
                              <button onClick={() => handleViewDoc(a.task_document_url!)} className="text-primary hover:underline text-[11px] flex items-center gap-0.5">
                                <FileText size={12} /> Xem
                              </button>
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[150px]">{a.note || "—"}</td>
                          {canManage && (
                            <td className="px-4 py-2.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => setEditTarget(a)}
                                  className="px-2 py-1 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors">
                                  <Pencil size={11} className="inline mr-0.5 -mt-px" />Sửa
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(a)}
                                  className="px-2 py-1 rounded bg-destructive/10 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors"
                                  disabled={remove.isPending}>
                                  <Trash2 size={11} className="inline mr-0.5 -mt-px" />Xóa
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Phần mở rộng: đợt nghiệm thu */}
                        {isExpanded && (
                          <>
                            {/* Sub-header */}
                            <tr className="bg-secondary/20">
                              <td colSpan={colCount} className="px-6 py-1.5">
                                <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  <span className="w-32">Đợt</span>
                                  <span className="w-28 text-right">Số tiền NT</span>
                                  <span className="w-28 text-right">Lũy kế</span>
                                  <span className="w-28 text-right">Còn lại</span>
                                  <span className="w-24">Ngày</span>
                                  <span className="flex-1">Ghi chú</span>
                                  {canManage && <span className="w-16 text-right">Thao tác</span>}
                                </div>
                              </td>
                            </tr>
                            {rounds.map((round, idx) => {
                              const cumulative = rounds.slice(0, idx + 1).reduce((s, r) => s + Number(r.amount), 0);
                              const remaining = Number(a.allocated_amount) - cumulative;
                              return (
                                <tr key={round.id} className="bg-secondary/5 border-b border-border/10 hover:bg-secondary/15 transition-colors">
                                  <td colSpan={colCount} className="px-6 py-2">
                                    <div className="flex items-center gap-4 text-xs">
                                      <span className="w-32 font-medium">{round.round_name}</span>
                                      <span className="w-28 text-right font-mono">{formatVND(Number(round.amount))}</span>
                                      <span className="w-28 text-right font-mono text-emerald-600">{formatVND(cumulative)}</span>
                                      <span className={`w-28 text-right font-mono ${remaining < 0 ? "text-destructive" : "text-amber-600"}`}>{formatVND(remaining)}</span>
                                      <span className="w-24 text-muted-foreground">{round.round_date ? formatDate(round.round_date) : "—"}</span>
                                      <span className="flex-1 text-muted-foreground truncate">{round.note || "—"}</span>
                                      {canManage && (
                                        <span className="w-16 flex items-center justify-end gap-1.5">
                                          <button onClick={() => setEditingRound(round)} className="text-primary hover:text-primary/70 p-0.5"><Pencil size={12} /></button>
                                          <button onClick={() => { if (confirm("Xóa đợt nghiệm thu này?")) removeRound.mutate(round.id); }}
                                            className="text-destructive hover:text-destructive/70 p-0.5"><Trash2 size={12} /></button>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {rounds.length === 0 && (
                              <tr className="bg-secondary/5"><td colSpan={colCount} className="px-6 py-3 text-center text-[11px] text-muted-foreground italic">Chưa có đợt nghiệm thu</td></tr>
                            )}
                            {/* Form thêm đợt nghiệm thu */}
                            {canManage && (
                              <tr className="bg-primary/[0.02] border-b border-border/20">
                                <td colSpan={colCount} className="px-6 py-2">
                                  <AddRoundInline allocationId={a.id} nextOrder={rounds.length} onSave={upsertRound.mutateAsync} isPending={upsertRound.isPending} />
                                </td>
                              </tr>
                            )}
                            {/* Tổng nghiệm thu */}
                            {rounds.length > 0 && (
                              <tr className="bg-secondary/20 border-b border-border/30">
                                <td colSpan={colCount} className="px-6 py-1.5">
                                  <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="w-32">Tổng NT</span>
                                    <span className="w-28 text-right font-mono">{formatVND(totalAccepted)}</span>
                                    <span className="w-28" />
                                    <span className={`w-28 text-right font-mono ${Number(a.allocated_amount) - totalAccepted < 0 ? "text-destructive" : "text-amber-600"}`}>
                                      {formatVND(Number(a.allocated_amount) - totalAccepted)}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                {!isDeptScoped && (
                  <tfoot>
                    <tr className="border-t border-border bg-secondary/20">
                      <td colSpan={3} className="px-4 py-2 font-bold">{t.kpi.totalAssigned}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{formatVND(total)}</td>
                      <td colSpan={canManage ? 5 : 4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Form inline thêm đợt nghiệm thu (hiện trong sub-row) ── */
function AddRoundInline({ allocationId, nextOrder, onSave, isPending }: {
  allocationId: string; nextOrder: number;
  onSave: (input: any) => Promise<any>; isPending: boolean;
}) {
  const [name, setName] = useState(`Đợt ${nextOrder + 1}`);
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    if (!name || amount <= 0) { toast.error("Nhập tên đợt và số tiền > 0"); return; }
    await onSave({ allocation_id: allocationId, round_name: name, amount, round_date: date || undefined, note: note || undefined, sort_order: nextOrder });
    setName(`Đợt ${nextOrder + 2}`);
    setAmount(0);
    setDate("");
    setNote("");
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên đợt"
        className="w-32 h-7 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
      <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(+e.target.value)} placeholder="Số tiền"
        className="w-28 h-7 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-28 h-7 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú"
        className="flex-1 h-7 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
      <button onClick={handleAdd} disabled={isPending}
        className="h-7 px-2.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1 disabled:opacity-50">
        <Plus size={12} /> Thêm
      </button>
    </div>
  );
}

/* ── Popup sửa đợt nghiệm thu ── */
function EditRoundModal({ round, onClose, onSave, isPending }: {
  round: AcceptanceRound; onClose: () => void;
  onSave: (input: any) => Promise<any>; isPending: boolean;
}) {
  const [name, setName] = useState(round.round_name);
  const [amount, setAmount] = useState(Number(round.amount));
  const [date, setDate] = useState(round.round_date || "");
  const [note, setNote] = useState(round.note || "");

  const handleSave = async () => {
    if (!name || amount <= 0) { toast.error("Nhập tên đợt và số tiền > 0"); return; }
    await onSave({ id: round.id, allocation_id: round.allocation_id, round_name: name, amount, round_date: date || undefined, note: note || undefined, sort_order: round.sort_order });
    onClose();
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";

  const inputClass2 = inputClass;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa đợt nghiệm thu</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Tên đợt</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass2} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Số tiền NT</label>
              <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(+e.target.value)} className={inputClass2 + " font-mono"} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Ngày</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass2} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Ghi chú</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass2} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal chỉnh sửa giao khoán ── */
function EditAllocationModal({ allocation, centers, departments, onClose, onSave, isPending }: {
  allocation: DeptBudgetAllocation;
  centers: { id: string; name: string; code: string | null }[];
  departments: { id: string; name: string; code: string | null; center_id: string | null }[];
  onClose: () => void;
  onSave: (input: any) => Promise<any>;
  isPending: boolean;
}) {
  const initTarget: AssignTarget = allocation.center_id ? "center" : "dept";
  const [assignTarget, setAssignTarget] = useState<AssignTarget>(initTarget);
  const [centerId, setCenterId] = useState(allocation.center_id || "");
  const [deptId, setDeptId] = useState(allocation.dept_id || "");
  const [amount, setAmount] = useState(Number(allocation.allocated_amount));
  const [startDate, setStartDate] = useState(allocation.start_date || "");
  const [endDate, setEndDate] = useState(allocation.end_date || "");

  const handleSave = async () => {
    if (assignTarget === "center" && !centerId) { toast.error("Vui lòng chọn trung tâm"); return; }
    if (assignTarget === "dept" && !deptId) { toast.error("Vui lòng chọn phòng ban"); return; }
    if (amount <= 0) { toast.error("Số tiền phải lớn hơn 0"); return; }
    await onSave({
      id: allocation.id,
      center_id: assignTarget === "center" ? centerId : null,
      dept_id: assignTarget === "dept" ? deptId : null,
      allocated_amount: amount,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    onClose();
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa giao khoán — {allocation.allocation_code || allocation.contract?.contract_no || ""}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Giao cho */}
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground font-medium">Giao cho</label>
              <div className="flex items-center gap-1 ml-auto">
                {(["center", "dept"] as const).map((v) => (
                  <button key={v} onClick={() => { setAssignTarget(v); setCenterId(""); setDeptId(""); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${assignTarget === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    {v === "center" ? "Trung tâm" : "Phòng ban"}
                  </button>
                ))}
              </div>
            </div>
            {assignTarget === "center" ? (
              <SearchSelect value={centerId} onChange={setCenterId}
                options={centers.map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))}
                placeholder="Chọn trung tâm" className="mt-1" />
            ) : (
              <SearchSelect value={deptId} onChange={setDeptId}
                options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                placeholder="Chọn phòng ban" className="mt-1" />
            )}
          </div>

          {/* Số tiền */}
          <div>
            <label className="text-sm text-muted-foreground font-medium">Số tiền giao khoán</label>
            <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(+e.target.value)}
              className={inputClass + " font-mono"} />
          </div>

          {/* Ngày bắt đầu / kết thúc */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Ngày bắt đầu</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Ngày kết thúc</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
