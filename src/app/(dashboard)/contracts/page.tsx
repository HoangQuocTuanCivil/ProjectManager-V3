"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useContracts, useCreateContract, useUpdateContract, useDeleteContract,
  useCreateAddendum, useDeleteAddendum,
  useCreateBillingMilestone, useUpdateBillingMilestone, useDeleteBillingMilestone,
} from "@/lib/hooks/use-contracts";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { FileText, TrendingUp, TrendingDown, Clock, CreditCard, ChevronRight } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Contract, ContractAddendum, BillingMilestone, ContractType } from "@/lib/types";

const supabase = createClient();

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", active: "#3b82f6", completed: "#10b981",
  terminated: "#ef4444", paused: "#f59e0b", settled: "#8b5cf6",
};
const MILESTONE_STATUS_COLORS: Record<string, string> = {
  upcoming: "#94a3b8", invoiced: "#f59e0b", paid: "#10b981", overdue: "#ef4444",
};

type ActiveTab = "outgoing" | "incoming";

export default function ContractsPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const canManage = user && ["admin", "leader", "director"].includes(user.role);

  const [activeTab, setActiveTab] = useState<ActiveTab>("outgoing");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");

  const projectFilter = filterProjectId !== "all" ? filterProjectId : undefined;
  const { data: outgoing = [] } = useContracts({ type: "outgoing", projectId: projectFilter });
  const { data: incoming = [] } = useContracts({ type: "incoming", projectId: projectFilter });

  const contracts = activeTab === "outgoing" ? outgoing : incoming;

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">{t.contracts.pageSubtitle}</p>

      {/* ── Dashboard Overview ── */}
      <DashboardOverview outgoing={outgoing} incoming={incoming} />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton
          active={activeTab === "outgoing"}
          onClick={() => setActiveTab("outgoing")}
          label={t.contracts.tabOutgoing}
          count={outgoing.length}
        />
        <TabButton
          active={activeTab === "incoming"}
          onClick={() => setActiveTab("incoming")}
          label={t.contracts.tabIncoming}
          count={incoming.length}
        />
      </div>

      {/* ── Filter + Action ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-64">
          <SearchSelect
            value={filterProjectId}
            onChange={setFilterProjectId}
            options={[
              { value: "all", label: t.contracts.allProjects },
              ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
            ]}
            placeholder={t.contracts.selectProject}
          />
        </div>
        {canManage && (
          <CreateContractButton
            activeTab={activeTab}
            projects={projects}
          />
        )}
      </div>

      {/* ── Contract List ── */}
      {contracts.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} strokeWidth={1.5} />}
          title={activeTab === "outgoing" ? t.contracts.noOutgoing : t.contracts.noIncoming}
          subtitle={activeTab === "outgoing" ? t.contracts.noOutgoingSub : t.contracts.noIncomingSub}
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} canManage={!!canManage} contractType={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Dashboard Overview
   ═══════════════════════════════════════════════════════════════════ */

function DashboardOverview({ outgoing, incoming }: { outgoing: Contract[]; incoming: Contract[] }) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const totalOut = outgoing.reduce((s, c) => s + Number(c.contract_value), 0);
    const totalIn = incoming.reduce((s, c) => s + Number(c.contract_value), 0);

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const allContracts = [...outgoing, ...incoming];
    const expiring = allContracts.filter(
      (c) => c.end_date && c.status === "active" && new Date(c.end_date) <= in30 && new Date(c.end_date) >= now
    );

    const allMilestones = outgoing.flatMap((c) => c.milestones || []);
    const totalMilestoneValue = allMilestones.reduce((s, m) => s + Number(m.amount), 0);
    const paidValue = allMilestones
      .filter((m) => m.status === "paid")
      .reduce((s, m) => s + Number(m.amount), 0);
    const paidPct = totalMilestoneValue > 0 ? Math.round((paidValue / totalMilestoneValue) * 100) : 0;

    const monthlyRevenue: Record<string, number> = {};
    allMilestones
      .filter((m) => m.due_date && ["upcoming", "invoiced"].includes(m.status))
      .forEach((m) => {
        const key = m.due_date!.slice(0, 7);
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(m.amount);
      });
    const sortedMonths = Object.entries(monthlyRevenue).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);
    const maxMonth = Math.max(...sortedMonths.map(([, v]) => v), 1);

    return { totalOut, totalIn, expiring, paidValue, paidPct, totalMilestoneValue, sortedMonths, maxMonth };
  }, [outgoing, incoming]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Tổng giá trị HĐ */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{t.contracts.totalOutgoing}</span>
        </div>
        <p className="text-lg font-bold font-mono">{formatVND(stats.totalOut)}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingDown size={12} />
          <span>{t.contracts.totalIncoming}: <span className="font-mono font-semibold text-foreground">{formatVND(stats.totalIn)}</span></span>
        </div>
      </div>

      {/* HĐ sắp hết hạn */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Clock size={16} className="text-amber-500" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{t.contracts.expiringContracts}</span>
        </div>
        <p className="text-lg font-bold">{stats.expiring.length} <span className="text-sm font-normal text-muted-foreground">{t.contracts.count}</span></p>
        <p className="mt-2 text-xs text-muted-foreground">{t.contracts.expiringInDays}</p>
      </div>

      {/* Trạng thái thanh toán */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CreditCard size={16} className="text-emerald-500" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{t.contracts.paymentStatus}</span>
        </div>
        <p className="text-lg font-bold">{stats.paidPct}%</p>
        <div className="mt-2 w-full h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.paidPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{t.contracts.paidPercent}: {formatVND(stats.paidValue)}</span>
          <span>{t.contracts.remainingAmount}: {formatVND(stats.totalMilestoneValue - stats.paidValue)}</span>
        </div>
      </div>

      {/* Biểu đồ doanh thu dự kiến */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-muted-foreground">{t.contracts.projectedRevenue}</span>
        </div>
        {stats.sortedMonths.length > 0 ? (
          <div className="flex items-end gap-1 h-16">
            {stats.sortedMonths.map(([month, value]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/70 rounded-t"
                  style={{ height: `${Math.max((value / stats.maxMonth) * 100, 8)}%` }}
                  title={`${month}: ${formatVND(value)}`}
                />
                <span className="text-[9px] text-muted-foreground">{month.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-4">{t.common.noData}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab Button
   ═══════════════════════════════════════════════════════════════════ */

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${
        active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
      }`}>
        {count}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Create Contract Button + Form
   ═══════════════════════════════════════════════════════════════════ */

function CreateContractButton({ activeTab, projects }: { activeTab: ActiveTab; projects: any[] }) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const createContract = useCreateContract();
  const isOutgoing = activeTab === "outgoing";

  const emptyForm = {
    project_id: "", contract_no: "", title: "", client_name: "", bid_package: "",
    contract_value: 0, vat_value: 0, signed_date: "", start_date: "", end_date: "",
    guarantee_value: 0, guarantee_expiry: "", status: "draft" as string, notes: "",
    subcontractor_name: "", work_content: "", person_in_charge: "",
  };
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    if (!form.project_id || !form.contract_no || !form.title || !form.contract_value) {
      toast.error("Vui lòng nhập đủ thông tin bắt buộc");
      return;
    }
    try {
      await createContract.mutateAsync({
        project_id: form.project_id,
        contract_type: activeTab,
        contract_no: form.contract_no,
        title: form.title,
        client_name: form.client_name || undefined,
        bid_package: form.bid_package || undefined,
        contract_value: form.contract_value,
        vat_value: form.vat_value || undefined,
        signed_date: form.signed_date || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        guarantee_value: form.guarantee_value || undefined,
        guarantee_expiry: form.guarantee_expiry || undefined,
        status: form.status,
        notes: form.notes || undefined,
        subcontractor_name: form.subcontractor_name || undefined,
        work_content: form.work_content || undefined,
        person_in_charge: form.person_in_charge || undefined,
      });
      toast.success("Tạo hợp đồng thành công!");
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo hợp đồng");
    }
  };

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const inputCls = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelCls = "text-sm text-muted-foreground font-medium";

  const outgoingStatuses = [
    { value: "draft", label: t.contracts.statusDraft },
    { value: "active", label: t.contracts.statusActive },
    { value: "completed", label: t.contracts.statusCompleted },
    { value: "paused", label: t.contracts.statusPaused },
    { value: "terminated", label: t.contracts.statusTerminated },
  ];

  const incomingStatuses = [
    { value: "draft", label: t.contracts.statusDraft },
    { value: "active", label: t.contracts.statusActive },
    { value: "settled", label: t.contracts.statusSettled },
  ];

  return (
    <>
      <Button variant="primary" onClick={() => setShowForm(!showForm)}>
        {showForm ? t.common.cancel : t.contracts.newContract}
      </Button>

      {showForm && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 animate-slide-in-bottom">
          <h3 className="text-base font-bold text-primary">{t.contracts.newContract}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{t.contracts.selectProject} *</label>
              <SearchSelect
                value={form.project_id}
                onChange={(v) => set({ project_id: v })}
                options={projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                placeholder={t.contracts.selectProject}
                className="mt-1"
              />
            </div>
            <div>
              <label className={labelCls}>{t.contracts.contractNo} *</label>
              <input value={form.contract_no} onChange={(e) => set({ contract_no: e.target.value })} placeholder="HD-2026-001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.contracts.status}</label>
              <SearchSelect
                value={form.status}
                onChange={(v) => set({ status: v })}
                options={isOutgoing ? outgoingStatuses : incomingStatuses}
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>{t.contracts.contractTitle} *</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} />
            </div>

            {isOutgoing ? (
              <div>
                <label className={labelCls}>{t.contracts.clientName}</label>
                <input value={form.client_name} onChange={(e) => set({ client_name: e.target.value })} className={inputCls} />
              </div>
            ) : (
              <div>
                <label className={labelCls}>{t.contracts.subcontractorName} *</label>
                <input value={form.subcontractor_name} onChange={(e) => set({ subcontractor_name: e.target.value })} className={inputCls} />
              </div>
            )}

            <div>
              <label className={labelCls}>{t.contracts.bidPackage}</label>
              <input value={form.bid_package} onChange={(e) => set({ bid_package: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{isOutgoing ? t.contracts.contractValue : t.contracts.subcontractValue} *</label>
              <input type="number" min={0} value={form.contract_value || ""} onChange={(e) => set({ contract_value: +e.target.value })} className={`${inputCls} font-mono`} />
            </div>

            {isOutgoing && (
              <div>
                <label className={labelCls}>{t.contracts.vatValue}</label>
                <input type="number" min={0} value={form.vat_value || ""} onChange={(e) => set({ vat_value: +e.target.value })} className={`${inputCls} font-mono`} />
              </div>
            )}

            <div>
              <label className={labelCls}>{t.contracts.signedDate}</label>
              <input type="date" value={form.signed_date} onChange={(e) => set({ signed_date: e.target.value })} className={inputCls} />
            </div>

            {isOutgoing && (
              <>
                <div>
                  <label className={labelCls}>{t.contracts.startDate}</label>
                  <input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.endDate}</label>
                  <input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.guaranteeValue}</label>
                  <input type="number" min={0} value={form.guarantee_value || ""} onChange={(e) => set({ guarantee_value: +e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.guaranteeExpiry}</label>
                  <input type="date" value={form.guarantee_expiry} onChange={(e) => set({ guarantee_expiry: e.target.value })} className={inputCls} />
                </div>
              </>
            )}

            {!isOutgoing && (
              <>
                <div>
                  <label className={labelCls}>{t.contracts.workContent}</label>
                  <input value={form.work_content} onChange={(e) => set({ work_content: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.personInCharge}</label>
                  <input value={form.person_in_charge} onChange={(e) => set({ person_in_charge: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.endDate}</label>
                  <input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} className={inputCls} />
                </div>
              </>
            )}

            <div className={isOutgoing ? "col-span-3" : "col-span-3"}>
              <label className={labelCls}>{t.contracts.notes}</label>
              <input value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={createContract.isPending}>
              {createContract.isPending ? t.contracts.creating : t.contracts.createContract}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   File helpers
   ═══════════════════════════════════════════════════════════════════ */

function toStoragePath(fileUrl: string): string {
  const full = fileUrl.match(/contract-files\/(.+?)(?:\?|$)/);
  if (full) return decodeURIComponent(full[1]);
  return fileUrl;
}

function ContractFileViewer({ fileUrl, label }: { fileUrl: string; label: string }) {
  const [showViewer, setShowViewer] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const path = toStoragePath(fileUrl);
  const isPdf = /\.pdf$/i.test(path);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showViewer) {
      setShowViewer(false);
      if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("contract-files").download(path);
      if (error) throw error;
      setBlobUrl(URL.createObjectURL(data));
      setShowViewer(true);
    } catch (err: any) {
      toast.error(`Lỗi tải PDF: ${err.message}`);
    }
    setLoading(false);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data, error } = await supabase.storage.from("contract-files").createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{label}:</span>
        {isPdf ? (
          <button type="button" onClick={handleToggle} disabled={loading}
            className="text-xs text-primary hover:underline font-medium disabled:opacity-50">
            {loading ? "Đang tải..." : showViewer ? "Ẩn PDF" : "Xem PDF"}
          </button>
        ) : (
          <button type="button" onClick={handleDownload} className="text-xs text-primary hover:underline">Xem file</button>
        )}
        <button type="button" onClick={handleDownload} className="text-xs text-muted-foreground hover:underline">Tải về</button>
      </div>
      {showViewer && isPdf && blobUrl && (
        <div className="mt-2 mx-auto max-w-2xl rounded-lg border border-border overflow-hidden bg-secondary/30">
          <iframe src={blobUrl} className="w-full h-[600px]" title="Contract PDF" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Contract Card (expandable) — renders differently for outgoing/incoming
   ═══════════════════════════════════════════════════════════════════ */

function ContractCard({ contract: c, canManage, contractType }: {
  contract: Contract;
  canManage: boolean;
  contractType: ActiveTab;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const deleteContract = useDeleteContract();
  const updateContract = useUpdateContract();

  const addendums = c.addendums || [];
  const milestones = c.milestones || [];
  const addendumTotal = addendums.reduce((s, a) => s + Number(a.value_change), 0);
  const currentValue = Number(c.contract_value);
  const statusColor = STATUS_COLORS[c.status] || "#94a3b8";
  const statusLabel = (t.contracts as any)[`status${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`] || c.status;

  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount), 0);
  const overdueCount = milestones.filter((m) =>
    m.status === "overdue" || (m.status === "upcoming" && m.due_date && new Date(m.due_date) < new Date())
  ).length;

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `contracts/${c.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("contract-files").upload(path, file, { cacheControl: "3600" });
    if (error) { toast.error("Lỗi upload file"); return null; }
    return path;
  };

  const isOutgoing = contractType === "outgoing";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/20 transition-colors"
      >
        <ChevronRight size={16} className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{c.contract_no}</span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ background: `${statusColor}20`, color: statusColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold truncate mt-0.5">{c.title}</p>
          {isOutgoing && c.client_name && (
            <p className="text-[11px] text-muted-foreground">
              {c.client_name}
              {c.bid_package && <span className="ml-2 text-muted-foreground/70">· {c.bid_package}</span>}
            </p>
          )}
          {!isOutgoing && c.subcontractor_name && (
            <p className="text-[11px] text-muted-foreground">{c.subcontractor_name}</p>
          )}
        </div>

        {/* Value */}
        <div className="flex-shrink-0 text-right space-y-0.5">
          <p className="text-sm font-bold font-mono">{formatVND(currentValue)}</p>
          {isOutgoing && Number(c.vat_value) > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono">VAT: {formatVND(Number(c.vat_value))}</p>
          )}
          {addendumTotal !== 0 && (
            <p className={`text-[10px] font-mono ${addendumTotal > 0 ? "text-primary" : "text-destructive"}`}>
              {addendumTotal > 0 ? "+" : ""}{formatVND(addendumTotal)} ({addendums.length} PL)
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="flex-shrink-0 text-right w-28">
          <p className="text-[11px] text-muted-foreground">
            {c.signed_date ? formatDate(c.signed_date) : "—"} → {c.end_date ? formatDate(c.end_date) : "—"}
          </p>
          {isOutgoing && overdueCount > 0 && (
            <p className="text-[10px] text-destructive font-medium mt-0.5">{overdueCount} {t.contracts.overdueAlert}</p>
          )}
          {!isOutgoing && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t.contracts.paidPercent}: {formatVND(totalPaid)}
            </p>
          )}
        </div>

        {c.project && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground font-medium">
            {c.project.code}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border animate-slide-in-bottom">
          {/* Detail row */}
          <div className="px-4 py-3 bg-secondary/20 grid grid-cols-4 gap-4 text-xs">
            {isOutgoing && (
              <>
                {c.start_date && (
                  <div>
                    <span className="text-muted-foreground">{t.contracts.startDate}</span>
                    <p className="font-medium">{formatDate(c.start_date)}</p>
                  </div>
                )}
                {c.guarantee_value > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t.contracts.guarantee}</span>
                    <p className="font-mono font-semibold">{formatVND(Number(c.guarantee_value))}</p>
                    {c.guarantee_expiry && <p className="text-muted-foreground">{formatDate(c.guarantee_expiry)}</p>}
                  </div>
                )}
              </>
            )}

            {!isOutgoing && (
              <>
                {c.work_content && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.contracts.workContent}</span>
                    <p className="font-medium">{c.work_content}</p>
                  </div>
                )}
                {c.person_in_charge && (
                  <div>
                    <span className="text-muted-foreground">{t.contracts.personInCharge}</span>
                    <p className="font-medium">{c.person_in_charge}</p>
                  </div>
                )}
              </>
            )}

            {c.file_url && (
              <div className="col-span-4">
                <ContractFileViewer fileUrl={c.file_url} label={t.contracts.file} />
              </div>
            )}
            {c.notes && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t.contracts.notes}</span>
                <p>{c.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {canManage && (
            <div className="px-4 py-2 border-t border-border/30 flex items-center gap-2">
              <label className="text-[11px] text-primary cursor-pointer hover:underline">
                {t.contracts.uploadFile}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadFile(file);
                  if (url) {
                    updateContract.mutate({ id: c.id, file_url: url } as any);
                    toast.success("Upload thành công!");
                  }
                }} />
              </label>
              <div className="flex-1" />
              <button
                onClick={() => {
                  if (confirm(t.contracts.confirmDelete.replace("{name}", c.title)))
                    deleteContract.mutate(c.id);
                }}
                className="text-[11px] text-destructive hover:underline"
              >
                {t.common.delete}
              </button>
            </div>
          )}

          {/* Outgoing: Addendums + Milestones */}
          {isOutgoing && (
            <>
              <AddendumSection contractId={c.id} addendums={addendums} canManage={canManage} />
              <BillingSection contractId={c.id} contractValue={currentValue} milestones={milestones} canManage={canManage} />
            </>
          )}

          {/* Incoming: Payment progress */}
          {!isOutgoing && (
            <BillingSection contractId={c.id} contractValue={currentValue} milestones={milestones} canManage={canManage} />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Addendums
   ═══════════════════════════════════════════════════════════════════ */

function AddendumSection({ contractId, addendums, canManage }: {
  contractId: string;
  addendums: ContractAddendum[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateAddendum();
  const remove = useDeleteAddendum();
  const [form, setForm] = useState({ addendum_no: "", title: "", addendum_value: 0, new_end_date: "", description: "", signed_date: "" });

  const handleCreate = async () => {
    if (!form.addendum_no || !form.title) { toast.error("Nhập số phụ lục và tên"); return; }
    try {
      await create.mutateAsync({
        contract_id: contractId,
        addendum_no: form.addendum_no,
        title: form.title,
        addendum_value: form.addendum_value,
        new_end_date: form.new_end_date || undefined,
        description: form.description || undefined,
        signed_date: form.signed_date || undefined,
      });
      toast.success("Tạo phụ lục thành công!");
      setShowForm(false);
      setForm({ addendum_no: "", title: "", addendum_value: 0, new_end_date: "", description: "", signed_date: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2 flex items-center justify-between bg-secondary/10">
        <h4 className="text-xs font-bold">{t.contracts.addendums} ({addendums.length})</h4>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="text-[11px] text-primary font-medium hover:underline">
            {showForm ? t.common.cancel : t.contracts.newAddendum}
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-4 py-3 bg-primary/5 border-t border-border/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.addendumNo}</label>
              <input value={form.addendum_no} onChange={(e) => setForm({ ...form, addendum_no: e.target.value })} placeholder="PL-01" className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.addendumTitle}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.addendumValue}</label>
              <input type="number" min={0} value={form.addendum_value || ""} onChange={(e) => setForm({ ...form, addendum_value: +e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.newEndDate}</label>
              <input type="date" value={form.new_end_date} onChange={(e) => setForm({ ...form, new_end_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.signedDate}</label>
              <input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="primary" onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? t.contracts.creatingAddendum : t.contracts.createAddendum}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">{t.contracts.description}</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          </div>
        </div>
      )}

      {addendums.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.addendumNo}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.addendumTitle}</th>
              <th className="text-right px-4 py-1.5 font-medium">{t.contracts.addendumValue}</th>
              <th className="text-right px-4 py-1.5 font-medium">{t.contracts.valueChange}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.signedDate}</th>
              {canManage && <th className="text-right px-4 py-1.5 font-medium w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {addendums.map((a) => (
              <tr key={a.id} className="hover:bg-secondary/20">
                <td className="px-4 py-1.5 font-mono">{a.addendum_no}</td>
                <td className="px-4 py-1.5">{a.title}</td>
                <td className="px-4 py-1.5 text-right font-mono font-semibold">{formatVND(Number(a.addendum_value))}</td>
                <td className={`px-4 py-1.5 text-right font-mono font-semibold ${Number(a.value_change) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {Number(a.value_change) >= 0 ? "+" : ""}{formatVND(Number(a.value_change))}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{formatDate(a.signed_date)}</td>
                {canManage && (
                  <td className="px-4 py-1.5 text-right">
                    <button
                      onClick={() => { if (confirm(t.contracts.confirmDeleteAddendum.replace("{name}", a.title))) remove.mutate({ id: a.id, contract_id: contractId }); }}
                      className="text-destructive hover:underline text-[10px]"
                    >{t.common.delete}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {addendums.length === 0 && !showForm && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground">{t.contracts.noAddendums}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Billing Milestones
   ═══════════════════════════════════════════════════════════════════ */

function BillingSection({ contractId, contractValue, milestones, canManage }: {
  contractId: string;
  contractValue: number;
  milestones: BillingMilestone[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateBillingMilestone();
  const update = useUpdateBillingMilestone();
  const remove = useDeleteBillingMilestone();
  const [form, setForm] = useState({ title: "", percentage: 0, amount: 0, due_date: "", invoice_no: "", notes: "" });

  const sorted = useMemo(() => [...milestones].sort((a, b) => a.sort_order - b.sort_order), [milestones]);
  const totalPct = sorted.reduce((s, m) => s + Number(m.percentage), 0);
  const totalInvoiced = sorted.filter((m) => ["invoiced", "paid"].includes(m.status)).reduce((s, m) => s + Number(m.amount), 0);
  const totalPaid = sorted.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount), 0);

  const handleCreate = async () => {
    if (!form.title || !form.percentage) { toast.error("Nhập tên mốc và tỷ lệ %"); return; }
    try {
      await create.mutateAsync({
        contract_id: contractId,
        title: form.title,
        percentage: form.percentage,
        amount: form.amount || Math.round(contractValue * form.percentage / 100),
        due_date: form.due_date || undefined,
        invoice_no: form.invoice_no || undefined,
        sort_order: sorted.length,
        notes: form.notes || undefined,
      });
      toast.success("Tạo mốc thanh toán thành công!");
      setShowForm(false);
      setForm({ title: "", percentage: 0, amount: 0, due_date: "", invoice_no: "", notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const statusLabelFn = (s: string) => (t.contracts as any)[`milestone${s.charAt(0).toUpperCase() + s.slice(1)}`] || s;

  return (
    <div className="border-t border-border">
      <div className="px-4 py-2 flex items-center justify-between bg-secondary/10">
        <h4 className="text-xs font-bold">{t.contracts.billingMilestones} ({sorted.length})</h4>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="text-[11px] text-primary font-medium hover:underline">
            {showForm ? t.common.cancel : t.contracts.newMilestone}
          </button>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="px-4 py-2 bg-secondary/20 flex items-center gap-4 text-[11px]">
          <span className="text-muted-foreground">{t.contracts.totalBilled}: <span className="font-semibold text-foreground font-mono">{formatVND(totalInvoiced)}</span></span>
          <span className="text-muted-foreground">{t.contracts.totalPaid}: <span className="font-semibold text-primary font-mono">{formatVND(totalPaid)}</span></span>
          <span className="text-muted-foreground">{t.contracts.totalRemaining}: <span className="font-semibold text-foreground font-mono">{formatVND(contractValue - totalPaid)}</span></span>
          <div className="flex-1" />
          <span className="text-muted-foreground">Tổng %: <span className={`font-semibold font-mono ${totalPct > 100 ? "text-destructive" : "text-foreground"}`}>{totalPct.toFixed(1)}%</span></span>
        </div>
      )}

      {showForm && (
        <div className="px-4 py-3 bg-primary/5 border-t border-border/30">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.milestoneTitle}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tạm ứng" className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.percentage}</label>
              <input
                type="number" min={0} max={100} step={0.1}
                value={form.percentage || ""}
                onChange={(e) => {
                  const pct = +e.target.value;
                  setForm({ ...form, percentage: pct, amount: Math.round(contractValue * pct / 100) });
                }}
                className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.amount}</label>
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t.contracts.dueDate}</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex items-end gap-3 mt-2">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">{t.contracts.notes}</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-0.5 w-full h-8 px-2 rounded border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
            </div>
            <Button size="sm" variant="primary" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? t.contracts.creatingMilestone : t.contracts.createMilestone}
            </Button>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.milestoneTitle}</th>
              <th className="text-right px-4 py-1.5 font-medium">%</th>
              <th className="text-right px-4 py-1.5 font-medium">{t.contracts.amount}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.dueDate}</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.status}</th>
              {canManage && <th className="text-right px-4 py-1.5 font-medium w-32" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {sorted.map((m) => {
              const isOverdue = m.status === "upcoming" && m.due_date && new Date(m.due_date) < new Date();
              const effectiveStatus = isOverdue ? "overdue" : m.status;
              const color = MILESTONE_STATUS_COLORS[effectiveStatus] || "#94a3b8";
              return (
                <tr key={m.id} className={`hover:bg-secondary/20 ${isOverdue ? "bg-destructive/5" : ""}`}>
                  <td className="px-4 py-2">{m.title}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(m.percentage).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{formatVND(Number(m.amount))}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(m.due_date)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {statusLabelFn(effectiveStatus)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right space-x-2">
                      {(effectiveStatus === "upcoming" || effectiveStatus === "overdue") && (
                        <button
                          onClick={() => update.mutate({ id: m.id, status: "invoiced" })}
                          className="text-[10px] text-primary hover:underline"
                        >{t.contracts.markInvoiced}</button>
                      )}
                      {effectiveStatus === "invoiced" && (
                        <button
                          onClick={() => update.mutate({ id: m.id, status: "paid", paid_date: new Date().toISOString().split("T")[0] })}
                          className="text-[10px] text-primary hover:underline"
                        >{t.contracts.markPaid}</button>
                      )}
                      <button
                        onClick={() => { if (confirm(t.contracts.confirmDeleteMilestone.replace("{name}", m.title))) remove.mutate(m.id); }}
                        className="text-[10px] text-destructive hover:underline"
                      >{t.common.delete}</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {sorted.length === 0 && !showForm && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground">{t.contracts.noMilestones}</p>
      )}
    </div>
  );
}
