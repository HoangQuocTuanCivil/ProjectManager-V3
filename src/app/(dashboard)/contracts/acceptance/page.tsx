"use client";

import { useState, useMemo } from "react";
import { useContracts, useUpdateBillingMilestone } from "@/lib/hooks/use-contracts";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { ClipboardCheck, Check, AlertTriangle } from "lucide-react";
import { formatVND, formatDate } from "@/lib/utils/format";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-600",
  invoiced: "bg-yellow-500/10 text-yellow-600",
  paid: "bg-green-500/10 text-green-600",
  overdue: "bg-red-500/10 text-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  upcoming: "Sắp đến hạn", invoiced: "Đã xuất HĐ", paid: "Đã thanh toán", overdue: "Quá hạn",
};

export default function AcceptancePage() {
  const { user } = useAuthStore();
  const { data: contracts = [] } = useContracts();
  const update = useUpdateBillingMilestone();
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const [filterContract, setFilterContract] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Gộp tất cả milestones từ mọi HĐ, kèm thông tin HĐ + dự án
  const milestones = useMemo(() => {
    const result: any[] = [];
    for (const c of contracts as any[]) {
      for (const m of c.milestones ?? []) {
        if (filterContract && c.id !== filterContract) continue;
        if (filterStatus && m.status !== filterStatus) continue;
        result.push({ ...m, contract: c, project: c.project });
      }
    }
    return result.sort((a, b) => {
      const order = { overdue: 0, upcoming: 1, invoiced: 2, paid: 3 };
      return (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9);
    });
  }, [contracts, filterContract, filterStatus]);

  // Tổng hợp thống kê
  const stats = useMemo(() => ({
    total: milestones.length,
    totalAmount: milestones.reduce((s, m) => s + Number(m.amount), 0),
    paid: milestones.filter((m) => m.status === "paid").reduce((s, m) => s + Number(m.amount), 0),
    overdue: milestones.filter((m) => m.status === "overdue").length,
  }), [milestones]);

  const handleMarkInvoiced = (id: string) => {
    update.mutate({ id, status: "invoiced" }, {
      onSuccess: () => toast.success("Đã đánh dấu xuất hoá đơn"),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleMarkPaid = (id: string) => {
    update.mutate({ id, status: "paid", paid_date: new Date().toISOString().split("T")[0] }, {
      onSuccess: () => toast.success("Đã ghi nhận thanh toán — doanh thu tự động tạo"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">
        Đối chiếu biên bản nghiệm thu với điều khoản hợp đồng, theo dõi thanh toán mốc
      </p>

      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Tổng mốc</p>
          <p className="text-lg font-bold font-mono">{stats.total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Giá trị mốc</p>
          <p className="text-lg font-bold font-mono">{formatVND(stats.totalAmount)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Đã thu</p>
          <p className="text-lg font-bold font-mono text-green-500">{formatVND(stats.paid)}</p>
        </div>
        <div className={`bg-card border rounded-xl p-3 ${stats.overdue > 0 ? "border-red-500/50" : "border-border"}`}>
          <p className="text-[11px] text-muted-foreground">Quá hạn</p>
          <p className={`text-lg font-bold font-mono ${stats.overdue > 0 ? "text-red-500" : ""}`}>{stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="w-64">
          <SearchSelect value={filterContract} onChange={setFilterContract}
            options={[
              { value: "", label: "Tất cả hợp đồng" },
              ...(contracts as any[]).map((c) => ({ value: c.id, label: `${c.contract_no} — ${c.title}` })),
            ]} placeholder="Lọc hợp đồng" />
        </div>
        <div className="w-44">
          <SearchSelect value={filterStatus} onChange={setFilterStatus}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              { value: "overdue", label: "Quá hạn" },
              { value: "upcoming", label: "Sắp đến hạn" },
              { value: "invoiced", label: "Đã xuất HĐ" },
              { value: "paid", label: "Đã thanh toán" },
            ]} />
        </div>
      </div>

      {/* Bảng */}
      {milestones.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={32} strokeWidth={1.5} />} title="Không có mốc nghiệm thu" subtitle="Tạo mốc thanh toán trong chi tiết hợp đồng" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Mốc thanh toán", "Hợp đồng", "Dự án", "Hạn thanh toán", "Giá trị", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {milestones.map((m) => (
                <tr key={m.id} className={`hover:bg-secondary/20 transition-colors ${m.status === "overdue" ? "bg-red-500/5" : ""}`}>
                  <td className="px-4 py-2.5 font-medium">{m.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.contract?.contract_no}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.project?.code || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDate(m.due_date)}
                    {m.status === "overdue" && <AlertTriangle size={11} className="inline ml-1 text-red-500" />}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold">{formatVND(Number(m.amount))}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && m.status === "upcoming" && (
                      <button onClick={() => handleMarkInvoiced(m.id)} className="text-blue-500 hover:underline text-[10px] mr-2">Xuất HĐ</button>
                    )}
                    {canManage && m.status === "invoiced" && (
                      <button onClick={() => handleMarkPaid(m.id)} className="text-green-500 hover:underline text-[10px] flex items-center gap-0.5">
                        <Check size={10} /> Thanh toán
                      </button>
                    )}
                    {canManage && m.status === "overdue" && (
                      <button onClick={() => handleMarkPaid(m.id)} className="text-red-500 hover:underline text-[10px]">Thanh toán trễ</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
