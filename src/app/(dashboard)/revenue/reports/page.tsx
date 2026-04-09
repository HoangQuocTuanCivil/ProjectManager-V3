"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useContracts } from "@/features/contracts";
import { formatVND } from "@/lib/utils/format";
import { SearchSelect } from "@/components/shared/search-select";
import { EmptyState } from "@/components/shared";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Lấy doanh thu confirmed per hợp đồng
function useContractRevenue() {
  return useQuery({
    queryKey: ["report", "contract-revenue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("revenue_entries")
        .select("contract_id, amount")
        .eq("status", "confirmed")
        .not("contract_id", "is", null);
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        map.set(r.contract_id!, (map.get(r.contract_id!) || 0) + Number(r.amount));
      }
      return map;
    },
  });
}

// Lấy chi phí per hợp đồng, phân theo loại kế toán
function useContractCosts() {
  return useQuery({
    queryKey: ["report", "contract-costs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cost_entries")
        .select("contract_id, category, amount")
        .not("contract_id", "is", null);
      // Group theo contract_id + category
      const map = new Map<string, { cogs: number; selling: number; admin: number; financial: number }>();
      for (const r of data ?? []) {
        const existing = map.get(r.contract_id!) || { cogs: 0, selling: 0, admin: 0, financial: 0 };
        existing[r.category as keyof typeof existing] += Number(r.amount);
        map.set(r.contract_id!, existing);
      }
      return map;
    },
  });
}

export default function BusinessReportPage() {
  const { data: contracts = [] } = useContracts();
  const { data: revenueMap = new Map() } = useContractRevenue();
  const { data: costsMap = new Map() } = useContractCosts();
  const [filterStatus, setFilterStatus] = useState("");

  // Tính báo cáo Lãi/Lỗ per hợp đồng
  const report = useMemo(() => {
    return (contracts as any[])
      .filter((c) => !filterStatus || c.status === filterStatus)
      .map((c) => {
        const revenue = revenueMap.get(c.id) || 0;
        const costs = costsMap.get(c.id) || { cogs: 0, selling: 0, admin: 0, financial: 0 };
        const grossProfit = revenue - costs.cogs;
        const opex = costs.selling + costs.admin;
        const ebt = grossProfit - opex - costs.financial;
        const margin = revenue > 0 ? Math.round((ebt / revenue) * 1000) / 10 : 0;
        return {
          id: c.id,
          contract_no: c.contract_no,
          title: c.title,
          project_code: c.project?.code || "—",
          client: c.client_name || "—",
          contract_value: Number(c.contract_value),
          revenue,
          cogs: costs.cogs,
          grossProfit,
          selling: costs.selling,
          admin: costs.admin,
          opex,
          financial: costs.financial,
          ebt,
          margin,
        };
      });
  }, [contracts, revenueMap, costsMap, filterStatus]);

  // Tổng cộng
  const totals = useMemo(() => report.reduce((acc, r) => ({
    contract_value: acc.contract_value + r.contract_value,
    revenue: acc.revenue + r.revenue,
    cogs: acc.cogs + r.cogs,
    grossProfit: acc.grossProfit + r.grossProfit,
    opex: acc.opex + r.opex,
    financial: acc.financial + r.financial,
    ebt: acc.ebt + r.ebt,
  }), { contract_value: 0, revenue: 0, cogs: 0, grossProfit: 0, opex: 0, financial: 0, ebt: 0 }), [report]);

  const totalMargin = totals.revenue > 0 ? Math.round((totals.ebt / totals.revenue) * 1000) / 10 : 0;

  // Export Excel
  const handleExport = () => {
    const rows = report.map((r) => ({
      "Số HĐ": r.contract_no,
      "Dự án": r.project_code,
      "Khách hàng": r.client,
      "1. Doanh thu HĐ": r.revenue,
      "2. (-) Giá vốn trực tiếp": r.cogs,
      "3. (=) Lãi gộp": r.grossProfit,
      "4. (-) CP bán hàng + QLDN": r.opex,
      "5. (-) CP tài chính": r.financial,
      "6. (=) Lợi nhuận trước thuế": r.ebt,
      "7. Tỷ suất LN %": r.margin,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lãi lỗ HĐ");
    XLSX.writeFile(wb, `BC_Kinh_Doanh_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã tải báo cáo Excel");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">
        Báo cáo Lãi/Lỗ theo Hợp đồng — Doanh thu − Giá vốn − Chi phí = Lợi nhuận
      </p>

      {/* Thống kê tổng */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Doanh thu HĐ", value: totals.revenue, color: "text-green-500" },
          { label: "(-) Giá vốn", value: totals.cogs, color: "text-red-400" },
          { label: "(=) Lãi gộp", value: totals.grossProfit, color: totals.grossProfit >= 0 ? "text-green-500" : "text-red-500" },
          { label: "(-) CP BH+QLDN", value: totals.opex, color: "text-yellow-500" },
          { label: "(-) CP tài chính", value: totals.financial, color: "text-purple-500" },
          { label: "(=) LN trước thuế", value: totals.ebt, color: totals.ebt >= 0 ? "text-green-500" : "text-red-500" },
          { label: "Tỷ suất LN", value: null, color: totalMargin >= 0 ? "text-green-500" : "text-red-500", pct: totalMargin },
        ].map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-base font-bold font-mono ${c.color}`}>
              {c.pct !== undefined ? `${c.pct}%` : formatVND(c.value!)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex items-center gap-3">
        <div className="w-44">
          <SearchSelect value={filterStatus} onChange={setFilterStatus}
            options={[
              { value: "", label: "Tất cả HĐ" },
              { value: "active", label: "Đang thực hiện" },
              { value: "completed", label: "Hoàn thành" },
            ]} />
        </div>
        <div className="flex-1" />
        <button onClick={handleExport}
          className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors">
          <Download size={13} /> Xuất Excel
        </button>
      </div>

      {/* Bảng Lãi/Lỗ chi tiết per HĐ */}
      {report.length === 0 ? (
        <EmptyState icon={<FileText size={32} strokeWidth={1.5} />} title="Chưa có dữ liệu" subtitle="Cần có hợp đồng và doanh thu đã ghi nhận" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Hợp đồng", "Dự án", "1. DT hợp đồng", "2. (-) Giá vốn", "3. (=) Lãi gộp",
                  "4. (-) CP BH+QLDN", "5. (-) CP tài chính", "6. (=) LN trước thuế", "7. Tỷ suất"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {report.map((r) => (
                <tr key={r.id} className={`hover:bg-secondary/20 transition-colors ${r.ebt < 0 ? "bg-red-500/5" : ""}`}>
                  <td className="px-3 py-2.5 font-medium">{r.contract_no}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.project_code}</td>
                  <td className="px-3 py-2.5 font-mono text-green-500">{formatVND(r.revenue)}</td>
                  <td className="px-3 py-2.5 font-mono text-red-400">{formatVND(r.cogs)}</td>
                  <td className={`px-3 py-2.5 font-mono font-semibold ${r.grossProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {formatVND(r.grossProfit)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-yellow-500">{formatVND(r.opex)}</td>
                  <td className="px-3 py-2.5 font-mono text-purple-500">{formatVND(r.financial)}</td>
                  <td className={`px-3 py-2.5 font-mono font-bold ${r.ebt >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {r.ebt >= 0 ? "+" : ""}{formatVND(r.ebt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.margin >= 20 ? "bg-green-500/10 text-green-600"
                      : r.margin >= 0 ? "bg-yellow-500/10 text-yellow-600"
                      : "bg-red-500/10 text-red-500"
                    }`}>{r.margin}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/30 font-bold">
                <td colSpan={2} className="px-3 py-2.5">TỔNG CỘNG</td>
                <td className="px-3 py-2.5 font-mono text-green-500">{formatVND(totals.revenue)}</td>
                <td className="px-3 py-2.5 font-mono text-red-400">{formatVND(totals.cogs)}</td>
                <td className={`px-3 py-2.5 font-mono ${totals.grossProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatVND(totals.grossProfit)}
                </td>
                <td className="px-3 py-2.5 font-mono text-yellow-500">{formatVND(totals.opex)}</td>
                <td className="px-3 py-2.5 font-mono text-purple-500">{formatVND(totals.financial)}</td>
                <td className={`px-3 py-2.5 font-mono ${totals.ebt >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {totals.ebt >= 0 ? "+" : ""}{formatVND(totals.ebt)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    totalMargin >= 20 ? "bg-green-500/10 text-green-600"
                    : totalMargin >= 0 ? "bg-yellow-500/10 text-yellow-600"
                    : "bg-red-500/10 text-red-500"
                  }`}>{totalMargin}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
