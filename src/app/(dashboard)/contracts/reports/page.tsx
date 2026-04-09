"use client";

import { useState, useMemo } from "react";
import { useContracts } from "@/features/contracts";
import { useAuthStore } from "@/lib/stores";
import { EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { FileText, Download } from "lucide-react";
import { formatVND, formatDate } from "@/lib/utils/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp", active: "Đang thực hiện", completed: "Hoàn thành", terminated: "Đã huỷ",
};
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  active: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  terminated: "bg-red-500/10 text-red-500",
};

export default function ContractReportsPage() {
  const { data: contracts = [] } = useContracts();
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = useMemo(() => {
    let list = contracts as any[];
    if (filterStatus) list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [contracts, filterStatus]);

  // Thống kê tổng hợp
  const stats = useMemo(() => ({
    total: filtered.length,
    totalValue: filtered.reduce((s: number, c: any) => s + Number(c.contract_value || 0), 0),
    active: filtered.filter((c: any) => c.status === "active").length,
    completed: filtered.filter((c: any) => c.status === "completed").length,
    paidMilestones: filtered.reduce((s: number, c: any) =>
      s + (c.milestones ?? []).filter((m: any) => m.status === "paid").reduce((ms: number, m: any) => ms + Number(m.amount), 0), 0
    ),
  }), [filtered]);

  // Export Excel báo cáo tổng hợp HĐ
  const handleExport = () => {
    const rows = filtered.map((c: any) => ({
      "Số HĐ": c.contract_no,
      "Tên HĐ": c.title,
      "Dự án": c.project?.code || "",
      "Khách hàng": c.client_name || "",
      "Giá trị HĐ": c.contract_value,
      "Ngày ký": c.signed_date || "",
      "Ngày bắt đầu": c.start_date || "",
      "Ngày kết thúc": c.end_date || "",
      "Trạng thái": STATUS_LABEL[c.status] || c.status,
      "Số phụ lục": (c.addendums ?? []).length,
      "Số mốc TT": (c.milestones ?? []).length,
      "Đã thu": (c.milestones ?? []).filter((m: any) => m.status === "paid")
        .reduce((s: number, m: any) => s + Number(m.amount), 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hợp đồng");
    XLSX.writeFile(wb, `Bao_cao_HD_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã tải báo cáo Excel");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">
        Báo cáo tổng hợp theo hợp đồng / dự án — lưu hồ sơ điện tử, xuất Excel
      </p>

      {/* Thống kê */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Tổng HĐ", value: stats.total, color: "text-primary", isNum: true },
          { label: "Giá trị HĐ", value: stats.totalValue, color: "text-primary" },
          { label: "Đang thực hiện", value: stats.active, color: "text-blue-500", isNum: true },
          { label: "Hoàn thành", value: stats.completed, color: "text-green-500", isNum: true },
          { label: "Đã thu", value: stats.paidMilestones, color: "text-green-500" },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold font-mono ${c.color}`}>{c.isNum ? c.value : formatVND(c.value as number)}</p>
          </div>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex items-center gap-3">
        <div className="w-44">
          <SearchSelect value={filterStatus} onChange={setFilterStatus}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              { value: "active", label: "Đang thực hiện" },
              { value: "completed", label: "Hoàn thành" },
              { value: "draft", label: "Nháp" },
              { value: "terminated", label: "Đã huỷ" },
            ]} />
        </div>
        <div className="flex-1" />
        <button onClick={handleExport}
          className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors">
          <Download size={13} /> Xuất Excel
        </button>
      </div>

      {/* Bảng */}
      {filtered.length === 0 ? (
        <EmptyState icon={<FileText size={32} strokeWidth={1.5} />} title="Không có hợp đồng" subtitle="Tạo hợp đồng trong tab Hợp đồng" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Số HĐ", "Tên", "Dự án", "Khách hàng", "Giá trị", "Tiến độ thu", "PL", "Trạng thái"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((c: any) => {
                const paid = (c.milestones ?? []).filter((m: any) => m.status === "paid").reduce((s: number, m: any) => s + Number(m.amount), 0);
                const pct = Number(c.contract_value) > 0 ? Math.round((paid / Number(c.contract_value)) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{c.contract_no}</td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate">{c.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.project?.code || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.client_name || "—"}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{formatVND(c.contract_value)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="font-mono text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{(c.addendums ?? []).length}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
