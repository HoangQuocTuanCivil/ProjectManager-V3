"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useContracts, useCreateContract, useUpdateContract, useDeleteContract,
  useCreateAddendum, useDeleteAddendum,
  useCreateBillingMilestone, useUpdateBillingMilestone, useDeleteBillingMilestone,
} from "@/lib/hooks/use-contracts";
import { useAuthStore } from "@/lib/stores";
import { useProductServices } from "@/features/revenue/hooks/use-product-services";
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
      {/* ── Header: subtitle + filter + action ── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.contracts.pageSubtitle}</p>
        <div className="flex items-center gap-2">
          <div className="w-52">
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
              filterProjectId={filterProjectId}
            />
          )}
        </div>
      </div>

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

/** Loại popup đang mở, tương ứng với từng thẻ tổng quan */
type StatsPopupKey = "total" | "accepted" | "pending" | "payable" | "paid";

function DashboardOverview({ outgoing, incoming }: { outgoing: Contract[]; incoming: Contract[] }) {
  // Popup đang mở: null = đóng, string = tên KPI được chọn
  const [activePopup, setActivePopup] = useState<StatsPopupKey | null>(null);

  const stats = useMemo(() => {
    // Tổng giá trị HĐ đầu ra (doanh thu), bao gồm cả phụ lục hợp đồng
    const totalContractValue = outgoing.reduce((s, c) => {
      const addendumSum = (c.addendums || []).reduce((a, ad) => a + Number(ad.value_change), 0);
      return s + Number(c.contract_value) + addendumSum;
    }, 0);

    // Tập hợp tất cả các đợt nghiệm thu từ HĐ đầu ra
    const allMilestones = outgoing.flatMap((c) => c.milestones || []);

    // Đã nghiệm thu = tổng giá trị các đợt có trạng thái invoiced hoặc paid
    const acceptedValue = allMilestones
      .filter((m) => m.status === "invoiced" || m.status === "paid")
      .reduce((s, m) => s + Number(m.amount), 0);

    // Chưa thực hiện = Tổng giá trị HĐ − Lũy kế đã nghiệm thu
    const pendingValue = totalContractValue - acceptedValue;

    // Được thanh toán = tổng payable_amount (số tiền được phép thanh toán)
    const payableValue = allMilestones
      .reduce((s, m) => s + Number(m.payable_amount || 0), 0);

    // Đã thanh toán = tổng paid_amount (số tiền đã thực nhận)
    const paidValue = allMilestones
      .reduce((s, m) => s + Number(m.paid_amount || 0), 0);

    // Tỷ lệ phần trăm tiến độ nghiệm thu và thanh toán
    const acceptedPct = totalContractValue > 0 ? Math.round((acceptedValue / totalContractValue) * 100) : 0;
    const paidPct = payableValue > 0 ? Math.round((paidValue / payableValue) * 100) : 0;

    return { totalContractValue, acceptedValue, pendingValue, payableValue, paidValue, acceptedPct, paidPct };
  }, [outgoing]);

  // Cấu hình từng thẻ: key KPI, nhãn hiển thị, giá trị tổng, màu sắc và icon
  const cards: {
    key: StatsPopupKey;
    label: string;
    value: number;
    color: string;
    icon: React.ReactNode;
    sub?: string;
  }[] = [
    {
      key: "total",
      label: "Tổng giá trị HĐ",
      value: stats.totalContractValue,
      color: "text-primary",
      icon: <FileText size={16} className="text-primary" />,
      sub: `${outgoing.length} hợp đồng đầu ra`,
    },
    {
      key: "accepted",
      label: "Đã nghiệm thu",
      value: stats.acceptedValue,
      color: "text-emerald-500",
      icon: <TrendingUp size={16} className="text-emerald-500" />,
      sub: `${stats.acceptedPct}% giá trị HĐ`,
    },
    {
      key: "pending",
      label: "Chưa thực hiện",
      value: stats.pendingValue,
      color: "text-amber-500",
      icon: <Clock size={16} className="text-amber-500" />,
      sub: `${100 - stats.acceptedPct}% giá trị HĐ`,
    },
    {
      key: "payable",
      label: "Được thanh toán",
      value: stats.payableValue,
      color: "text-blue-500",
      icon: <CreditCard size={16} className="text-blue-500" />,
      sub: "Đã nghiệm thu & xuất HĐ",
    },
    {
      key: "paid",
      label: "Đã thanh toán",
      value: stats.paidValue,
      color: "text-green-600",
      icon: <TrendingUp size={16} className="text-green-600" />,
      sub: stats.payableValue > 0 ? `${stats.paidPct}% giá trị được TT` : "—",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 5 thẻ tổng quan — mỗi thẻ là nút bấm mở popup chi tiết */}
      <div className="grid grid-cols-5 gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActivePopup(c.key)}
            className="bg-card border border-border rounded-xl p-4 text-left
                       hover:border-primary/50 hover:shadow-sm transition-all group cursor-pointer"
            title="Nhấn để xem chi tiết"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {c.icon}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
            </div>
            <p className={`text-base font-bold font-mono ${c.color}`}>{formatVND(c.value)}</p>
            {c.sub && (
              <p className="mt-1 text-[10px] text-muted-foreground group-hover:text-primary/70 transition-colors">
                {c.sub}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Thanh tiến độ nghiệm thu + thanh toán */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Tiến độ nghiệm thu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Tiến độ nghiệm thu</span>
              <span className="text-xs font-bold text-emerald-500">{stats.acceptedPct}%</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.acceptedPct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>Đã NT: <span className="font-mono text-foreground">{formatVND(stats.acceptedValue)}</span></span>
              <span>Còn lại: <span className="font-mono text-foreground">{formatVND(stats.pendingValue)}</span></span>
            </div>
          </div>

          {/* Tiến độ thanh toán */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Tiến độ thanh toán</span>
              <span className="text-xs font-bold text-blue-500">{stats.paidPct}%</span>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${stats.paidPct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>Đã TT: <span className="font-mono text-foreground">{formatVND(stats.paidValue)}</span></span>
              <span>Chưa TT: <span className="font-mono text-foreground">{formatVND(stats.payableValue - stats.paidValue)}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Popup chi tiết hợp đồng theo KPI đang chọn */}
      {activePopup && (
        <ContractStatsPopup
          popupKey={activePopup}
          contracts={outgoing}
          onClose={() => setActivePopup(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Contract Stats Popup
   Hiển thị bảng danh sách hợp đồng đầu ra đóng góp vào KPI được chọn.
   ═══════════════════════════════════════════════════════════════════ */

/** Tiêu đề và cột giá trị cho từng popup */
const POPUP_CONFIG: Record<
  StatsPopupKey,
  { title: string; valueLabel: string; valueColor: string }
> = {
  total:    { title: "Tổng giá trị hợp đồng",  valueLabel: "Giá trị HĐ (kể cả Phụ lục)", valueColor: "text-primary" },
  accepted: { title: "Đã nghiệm thu",           valueLabel: "Giá trị đã nghiệm thu", valueColor: "text-emerald-500" },
  pending:  { title: "Chưa thực hiện",          valueLabel: "Giá trị chưa thực hiện",valueColor: "text-amber-500" },
  payable:  { title: "Được thanh toán",         valueLabel: "Giá trị được thanh toán",valueColor: "text-blue-500" },
  paid:     { title: "Đã thanh toán",           valueLabel: "Giá trị đã thanh toán",  valueColor: "text-green-600" },
};

/** Tính giá trị KPI của một hợp đồng theo loại popup */
function computeContractKpiValue(contract: Contract, key: StatsPopupKey): number {
  const baseValue = Number(contract.contract_value);
  const addendumSum = (contract.addendums || []).reduce(
    (s, a) => s + Number(a.value_change), 0
  );
  const totalValue = baseValue + addendumSum;
  const milestones = contract.milestones || [];

  switch (key) {
    case "total":
      // Giá trị hợp đồng bao gồm tất cả phụ lục điều chỉnh giá trị
      return totalValue;

    case "accepted":
      // Tổng giá trị các đợt nghiệm thu đã lập hoá đơn hoặc đã thanh toán
      return milestones
        .filter((m) => m.status === "invoiced" || m.status === "paid")
        .reduce((s, m) => s + Number(m.amount), 0);

    case "pending":
      // Phần giá trị hợp đồng chưa được nghiệm thu (= tổng HĐ − lũy kế)
      const accumulated = milestones
        .filter((m) => m.status === "invoiced" || m.status === "paid")
        .reduce((s, m) => s + Number(m.amount), 0);
      return totalValue - accumulated;

    case "payable":
      // Tổng số tiền được phép thanh toán theo các đợt nghiệm thu
      return milestones.reduce((s, m) => s + Number(m.payable_amount || 0), 0);

    case "paid":
      // Tổng số tiền đã thực sự thanh toán cho từng đợt
      return milestones.reduce((s, m) => s + Number(m.paid_amount || 0), 0);

    default:
      return 0;
  }
}

function ContractStatsPopup({
  popupKey,
  contracts,
  onClose,
}: {
  popupKey: StatsPopupKey;
  contracts: Contract[];
  onClose: () => void;
}) {
  const config = POPUP_CONFIG[popupKey];

  // Tính giá trị KPI từng hợp đồng và loại bỏ những hợp đồng có giá trị = 0
  const rows = contracts
    .map((c) => ({ contract: c, kpiValue: computeContractKpiValue(c, popupKey) }))
    .filter((r) => r.kpiValue !== 0);

  const grandTotal = rows.reduce((s, r) => s + r.kpiValue, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl
                   w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header popup */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div>
            <h3 className="text-sm font-bold text-foreground">{config.title}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Danh sách hợp đồng đầu ra (Doanh thu) · {rows.length} hợp đồng
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl p-1 rounded leading-none"
            aria-label="Đóng popup"
          >
            &times;
          </button>
        </div>

        {/* Bảng danh sách hợp đồng */}
        <div className="overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Không có dữ liệu</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-8">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Dự án</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Gói thầu</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Mã hợp đồng</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Tên hợp đồng</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">{config.valueLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ contract: c, kpiValue }, idx) => (
                  <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3">
                      {c.project ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono font-medium text-primary">{c.project.code}</span>
                          <span className="text-muted-foreground hidden xl:inline">— {c.project.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.bid_package || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{c.contract_no}</td>
                    <td className="px-4 py-3 font-medium max-w-[220px] truncate" title={c.title}>{c.title}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${config.valueColor}`}>
                      {formatVND(kpiValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: tổng cộng */}
        <div className="px-6 py-3 border-t border-border bg-secondary/30 rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tổng cộng</span>
          <span className={`font-mono font-bold text-sm ${config.valueColor}`}>{formatVND(grandTotal)}</span>
        </div>
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

const CAT_LABELS: Record<string, string> = {
  design: "Thiết kế", consulting: "Tư vấn", survey: "Khảo sát", supervision: "Giám sát", other: "Khác",
};

function CreateContractButton({ activeTab, projects, filterProjectId }: { activeTab: ActiveTab; projects: any[]; filterProjectId: string }) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const createContract = useCreateContract();
  const isOutgoing = activeTab === "outgoing";
  const { data: psRes } = useProductServices({ is_active: "true" });
  const productServices = psRes?.data ?? [];

  const preselectedProject = filterProjectId !== "all" ? filterProjectId : "";

  const emptyForm = {
    project_id: preselectedProject, contract_no: "", title: "", client_name: "", bid_package: "",
    contract_value: 0, vat_value: 0, signed_date: "", start_date: "", end_date: "",
    guarantee_value: 0, guarantee_expiry: "", status: "draft" as string, notes: "",
    subcontractor_name: "", work_content: "", person_in_charge: "",
    contract_scope: "internal" as string, product_service_id: "",
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
        contract_scope: form.contract_scope,
        product_service_id: form.product_service_id || undefined,
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
      <Button variant="primary" onClick={() => {
        setForm({ ...emptyForm, project_id: preselectedProject });
        setShowForm(true);
      }}>
        {t.contracts.newContract}
      </Button>

      {/* Modal tạo hợp đồng — overlay nổi lên trên trang */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tiêu đề modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
              <h3 className="text-base font-bold text-primary">{t.contracts.newContract}</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring"
                aria-label="Đóng"
              >
                &times;
              </button>
            </div>

            {/* Nội dung form — layout 4 cột theo thiết kế */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {/* Hàng 1: Dự án, Số HĐ, Gói thầu, Loại hình DV */}
                <div>
                  <label className={labelCls}>{t.contracts.selectProject} *</label>
                  {preselectedProject ? (
                    <p className="mt-1 h-9 px-3 flex items-center rounded-lg border border-border bg-secondary/50 text-base truncate">
                      {projects.find((p: any) => p.id === preselectedProject)?.code} — {projects.find((p: any) => p.id === preselectedProject)?.name}
                    </p>
                  ) : (
                    <SearchSelect
                      value={form.project_id}
                      onChange={(v) => set({ project_id: v })}
                      options={projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                      placeholder={t.contracts.selectProject}
                      className="mt-1"
                    />
                  )}
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.contractNo} *</label>
                  <input value={form.contract_no} onChange={(e) => set({ contract_no: e.target.value })} placeholder="HD-2026-001" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.bidPackage}</label>
                  <input value={form.bid_package} onChange={(e) => set({ bid_package: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.clientName}</label>
                  <SearchSelect
                    value={form.product_service_id}
                    onChange={(v) => set({ product_service_id: v })}
                    options={productServices.map((ps: any) => ({
                      value: ps.id,
                      label: `${ps.code} — ${ps.name}`,
                      sublabel: CAT_LABELS[ps.category] || ps.category,
                    }))}
                    placeholder="Chọn SP/DV..."
                    className="mt-1"
                  />
                </div>

                {/* Hàng 2: Tên HĐ (rộng 2 cột), Trạng thái, Phạm vi */}
                <div className="col-span-2">
                  <label className={labelCls}>{t.contracts.contractTitle} *</label>
                  <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} />
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
                <div>
                  <label className={labelCls}>Phạm vi</label>
                  <SearchSelect
                    value={form.contract_scope}
                    onChange={(v) => set({ contract_scope: v })}
                    options={[
                      { value: "internal", label: "Trong hệ thống" },
                      { value: "external", label: "Ngoài hệ thống" },
                    ]}
                    className="mt-1"
                  />
                </div>

                {/* Hàng 3: Giá trị chưa VAT, đã VAT, bảo lãnh, ngày ký */}
                <div>
                  <label className={labelCls}>{isOutgoing ? t.contracts.contractValue : t.contracts.subcontractValue} *</label>
                  <input type="number" min={0} value={form.contract_value || ""} onChange={(e) => set({ contract_value: +e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.vatValue}</label>
                  <input type="number" min={0} value={form.vat_value || ""} onChange={(e) => set({ vat_value: +e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.guaranteeValue}</label>
                  <input type="number" min={0} value={form.guarantee_value || ""} onChange={(e) => set({ guarantee_value: +e.target.value })} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.signedDate}</label>
                  <input type="date" value={form.signed_date} onChange={(e) => set({ signed_date: e.target.value })} className={inputCls} />
                </div>

                {/* Hàng 4: Ngày bắt đầu, ngày hết hạn, hết hạn bảo lãnh */}
                <div>
                  <label className={labelCls}>{t.contracts.startDate}</label>
                  <input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.endDate}</label>
                  <input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.contracts.guaranteeExpiry}</label>
                  <input type="date" value={form.guarantee_expiry} onChange={(e) => set({ guarantee_expiry: e.target.value })} className={inputCls} />
                </div>

                {/* Hàng 5 (HĐ đầu vào): Nhà thầu phụ, Nội dung, Phụ trách */}
                {!isOutgoing && (
                  <>
                    <div>
                      <label className={labelCls}>{t.contracts.subcontractorName} *</label>
                      <input value={form.subcontractor_name} onChange={(e) => set({ subcontractor_name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.contracts.workContent}</label>
                      <input value={form.work_content} onChange={(e) => set({ work_content: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t.contracts.personInCharge}</label>
                      <input value={form.person_in_charge} onChange={(e) => set({ person_in_charge: e.target.value })} className={inputCls} />
                    </div>
                  </>
                )}

                {/* Ghi chú — toàn bộ chiều rộng */}
                <div className="col-span-4">
                  <label className={labelCls}>{t.contracts.notes}</label>
                  <input value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Footer cố định ở cuối modal */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createContract.isPending}>
                {createContract.isPending ? t.contracts.creating : t.contracts.createContract}
              </Button>
            </div>
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

  // Lũy kế = tổng giá trị đã nghiệm thu (invoiced + paid)
  const accumulated = milestones
    .filter((m) => ["invoiced", "paid"].includes(m.status))
    .reduce((s, m) => s + Number(m.amount), 0);
  // Còn lại chưa thực hiện = giá trị HĐ − lũy kế
  const remaining = currentValue - accumulated;
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

        {/* Giá trị HĐ | Lũy kế | Còn lại — luôn hiện đầy đủ */}
        <div className="flex-shrink-0 text-right space-y-0.5">
          <p className="text-sm font-bold font-mono">{formatVND(currentValue)}</p>
          <p className="text-[10px] font-mono text-emerald-500">Lũy kế: {formatVND(accumulated)}</p>
          <p className={`text-[10px] font-mono ${remaining >= 0 ? "text-amber-500" : "text-destructive"}`}>
            Còn lại: {formatVND(remaining)}
          </p>
        </div>

        {/* Thời hạn */}
        <div className="flex-shrink-0 text-right w-28">
          <p className="text-[11px] text-muted-foreground">
            {c.signed_date ? formatDate(c.signed_date) : "—"} → {c.end_date ? formatDate(c.end_date) : "—"}
          </p>
          {overdueCount > 0 && (
            <p className="text-[10px] text-destructive font-medium mt-0.5">{overdueCount} {t.contracts.overdueAlert}</p>
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
          <button onClick={() => setShowForm(true)} className="text-[11px] text-primary font-medium hover:underline">
            {t.contracts.newAddendum}
          </button>
        )}
      </div>

      {/* Modal tạo phụ lục */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-bold text-primary">{t.contracts.newAddendum}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.contracts.addendumNo} *</label>
                  <input value={form.addendum_no} onChange={(e) => setForm({ ...form, addendum_no: e.target.value })} placeholder="PL-01" className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.contracts.addendumTitle} *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.contracts.addendumValue}</label>
                  <input type="number" min={0} value={form.addendum_value || ""} onChange={(e) => setForm({ ...form, addendum_value: +e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.contracts.newEndDate}</label>
                  <input type="date" value={form.new_end_date} onChange={(e) => setForm({ ...form, new_end_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground font-medium">{t.contracts.signedDate}</label>
                  <input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">{t.contracts.description}</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <Button onClick={() => setShowForm(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? t.contracts.creatingAddendum : t.contracts.createAddendum}
              </Button>
            </div>
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
  // Lũy kế nghiệm thu
  const totalAccepted = sorted.filter((m) => ["invoiced", "paid"].includes(m.status)).reduce((s, m) => s + Number(m.amount), 0);
  // Tổng giá trị được thanh toán và đã thanh toán
  const totalPayable = sorted.reduce((s, m) => s + Number((m as any).payable_amount || 0), 0);
  const totalPaid = sorted.reduce((s, m) => s + Number((m as any).paid_amount || 0), 0);

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
          <span className="text-muted-foreground">Lũy kế NT: <span className="font-semibold text-foreground font-mono">{formatVND(totalAccepted)}</span></span>
          <span className="text-muted-foreground">Được TT: <span className="font-semibold text-amber-500 font-mono">{formatVND(totalPayable)}</span></span>
          <span className="text-muted-foreground">Đã TT: <span className="font-semibold text-green-500 font-mono">{formatVND(totalPaid)}</span></span>
          <span className="text-muted-foreground">Công nợ: <span className="font-semibold text-foreground font-mono">{formatVND(contractValue - totalPaid)}</span></span>
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
              <th className="text-right px-4 py-1.5 font-medium">GT nghiệm thu</th>
              <th className="text-right px-4 py-1.5 font-medium">Được TT</th>
              <th className="text-right px-4 py-1.5 font-medium">Đã TT</th>
              <th className="text-left px-4 py-1.5 font-medium">Ngày NT</th>
              <th className="text-left px-4 py-1.5 font-medium">{t.contracts.status}</th>
              {canManage && <th className="text-right px-4 py-1.5 font-medium w-16" />}
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
                  <td className="px-4 py-2 text-right font-mono">{contractValue > 0 ? ((Number(m.amount) / contractValue) * 100).toFixed(1) : 0}%</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{formatVND(Number(m.amount))}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-500">{Number((m as any).payable_amount) > 0 ? formatVND(Number((m as any).payable_amount)) : "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-500">{Number((m as any).paid_amount) > 0 ? formatVND(Number((m as any).paid_amount)) : "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(m.due_date)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: `${color}20`, color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {statusLabelFn(effectiveStatus)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
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
