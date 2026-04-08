"use client";

import { useState, useMemo } from "react";
import {
  useBusinessReport,
  type GroupBy,
  type BusinessRow,
  type BusinessTotals,
} from "@/features/revenue/hooks/use-business-report";
import { useCenters } from "@/lib/hooks";
import { formatVND } from "@/lib/utils/format";
import { SearchSelect } from "@/components/shared/search-select";
import { EmptyState } from "@/components/shared";
import { Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const supabase = createClient();

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: "company", label: "Toàn công ty" },
  { value: "center", label: "Theo trung tâm" },
  { value: "department", label: "Theo phòng ban" },
  { value: "product_service", label: "Theo sản phẩm/dịch vụ" },
];

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#a855f7", "#3b82f6", "#06b6d4"];

function useDepartments(centerId?: string) {
  return useQuery({
    queryKey: ["departments", centerId],
    queryFn: async () => {
      let q = supabase.from("departments").select("id, name, code, center_id")
        .eq("is_active", true).order("name");
      if (centerId) q = q.eq("center_id", centerId);
      const { data } = await q;
      return data ?? [];
    },
  });
}

export default function BusinessReportPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>("company");
  const [centerId, setCenterId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: centers = [] } = useCenters();
  const { data: departments = [] } = useDepartments(centerId || undefined);

  const filters = useMemo(() => ({
    group_by: groupBy,
    center_id: centerId || undefined,
    dept_id: deptId || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  }), [groupBy, centerId, deptId, dateFrom, dateTo]);

  const { data, isLoading } = useBusinessReport(filters);
  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {
    revenue: 0, cogs: 0, selling: 0, admin: 0, financial: 0,
    salary: 0, incoming: 0, total_cost: 0, profit: 0, margin: 0,
  };

  const centerOptions = useMemo(() => [
    { value: "", label: "Tất cả trung tâm" },
    ...(centers as any[]).map((c: any) => ({ value: c.id, label: c.name })),
  ], [centers]);

  const deptOptions = useMemo(() => [
    { value: "", label: "Tất cả phòng ban" },
    ...departments.map((d: any) => ({ value: d.id, label: d.name })),
  ], [departments]);

  const handleCenterChange = (v: string) => { setCenterId(v); setDeptId(""); };
  const handleGroupByChange = (v: string) => {
    setGroupBy(v as GroupBy);
    if (v === "company" || v === "product_service") { setCenterId(""); setDeptId(""); }
    if (v === "center") setDeptId("");
  };

  const handleExport = () => {
    if (!rows.length) return;
    const sheet = rows.map((r) => ({
      "Mã": r.code,
      "Tên": r.name,
      "Doanh thu": r.revenue,
      "Giá vốn": r.cogs,
      "CP bán hàng": r.selling,
      "CP quản lý": r.admin,
      "CP tài chính": r.financial,
      "Lương": r.salary,
      "HĐ giao khoán": r.incoming,
      "Tổng chi phí": r.total_cost,
      "Lợi nhuận": r.profit,
      "Tỷ suất LN (%)": r.margin,
    }));
    sheet.push({
      "Mã": "", "Tên": "TỔNG CỘNG",
      "Doanh thu": totals.revenue, "Giá vốn": totals.cogs,
      "CP bán hàng": totals.selling, "CP quản lý": totals.admin,
      "CP tài chính": totals.financial, "Lương": totals.salary,
      "HĐ giao khoán": totals.incoming, "Tổng chi phí": totals.total_cost,
      "Lợi nhuận": totals.profit, "Tỷ suất LN (%)": totals.margin,
    });
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo kinh doanh");
    XLSX.writeFile(wb, `BC_Kinh_Doanh_${groupBy}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã tải báo cáo Excel");
  };

  const showCenterFilter = groupBy === "center" || groupBy === "department";
  const showDeptFilter = groupBy === "department";
  const groupLabel = GROUP_OPTIONS.find((o) => o.value === groupBy)?.label ?? "";

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-muted-foreground">
        Doanh thu − Chi phí − Giao khoán = Lợi nhuận · {groupLabel}
      </p>

      <SummaryCards totals={totals} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SearchSelect value={groupBy} onChange={handleGroupByChange}
            options={GROUP_OPTIONS} placeholder="Nhóm theo" />
        </div>
        {showCenterFilter && (
          <div className="w-44">
            <SearchSelect value={centerId} onChange={handleCenterChange}
              options={centerOptions} placeholder="Trung tâm" />
          </div>
        )}
        {showDeptFilter && (
          <div className="w-44">
            <SearchSelect value={deptId} onChange={setDeptId}
              options={deptOptions} placeholder="Phòng ban" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
        </div>
        <div className="flex-1" />
        <button onClick={handleExport} disabled={!rows.length}
          className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors disabled:opacity-40">
          <Download size={13} /> Xuất Excel
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Đang tải dữ liệu...</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText size={32} strokeWidth={1.5} />}
          title="Chưa có dữ liệu" subtitle="Cần có doanh thu hoặc chi phí đã ghi nhận" />
      ) : (
        <>
          <Charts rows={rows} totals={totals} groupBy={groupBy} />
          <ReportTable rows={rows} totals={totals} groupBy={groupBy} />
        </>
      )}
    </div>
  );
}

function SummaryCards({ totals }: { totals: BusinessTotals }) {
  const items: Array<{ label: string; value: number; color: string; pct?: boolean }> = [
    { label: "Doanh thu", value: totals.revenue, color: "text-green-500" },
    { label: "Tổng chi phí", value: totals.total_cost, color: "text-orange-500" },
    { label: "HĐ giao khoán", value: totals.incoming, color: "text-cyan-500" },
    { label: "Lương", value: totals.salary, color: "text-blue-500" },
    { label: "Lợi nhuận", value: totals.profit, color: totals.profit >= 0 ? "text-green-500" : "text-red-500" },
    { label: "Tỷ suất LN", value: totals.margin, color: totals.margin >= 0 ? "text-green-500" : "text-red-500", pct: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
          <p className={`text-base font-bold font-mono ${item.color}`}>
            {item.pct ? `${item.value}%` : formatVND(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function Charts({ rows, totals, groupBy }: {
  rows: BusinessRow[];
  totals: BusinessTotals;
  groupBy: GroupBy;
}) {
  const barData = useMemo(() => {
    if (groupBy === "company") return [];
    return rows.slice(0, 10).map((r) => ({
      name: r.code || r.name.slice(0, 12),
      "Doanh thu": r.revenue,
      "Chi phí": r.total_cost,
      "Lợi nhuận": r.profit,
    }));
  }, [rows, groupBy]);

  const pieData = useMemo(() => {
    const items = [
      { name: "Giá vốn", value: totals.cogs },
      { name: "CP bán hàng", value: totals.selling },
      { name: "CP quản lý", value: totals.admin },
      { name: "CP tài chính", value: totals.financial },
      { name: "Lương", value: totals.salary },
      { name: "HĐ giao khoán", value: totals.incoming },
    ];
    return items.filter((i) => i.value > 0);
  }, [totals]);

  const showBar = barData.length > 1;

  return (
    <div className={`grid gap-4 ${showBar ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1 lg:grid-cols-2"}`}>
      {showBar && (
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Doanh thu · Chi phí · Lợi nhuận
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Doanh thu" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Chi phí" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lợi nhuận" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {pieData.length > 0 && (
        <div className={showBar ? "lg:col-span-2" : ""}>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Cơ cấu chi phí</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatVND(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTable({ rows, totals, groupBy }: {
  rows: BusinessRow[];
  totals: BusinessTotals;
  groupBy: GroupBy;
}) {
  const nameHeader = groupBy === "center" ? "Trung tâm"
    : groupBy === "department" ? "Phòng ban"
    : groupBy === "product_service" ? "Sản phẩm/DV"
    : "Đơn vị";

  const headers = [
    nameHeader, "Doanh thu", "Giá vốn", "CP BH", "CP QLDN",
    "CP tài chính", "Lương", "HĐ giao khoán", "Tổng CP", "Lợi nhuận", "Tỷ suất",
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map((r) => (
            <tr key={r.id} className={`hover:bg-secondary/20 transition-colors ${r.profit < 0 ? "bg-red-500/5" : ""}`}>
              <td className="px-3 py-2.5 font-medium">
                {r.name}
                {r.code && <span className="ml-1.5 text-muted-foreground text-[10px]">{r.code}</span>}
              </td>
              <CurrencyCell value={r.revenue} color="text-green-500" />
              <CurrencyCell value={r.cogs} color="text-red-400" />
              <CurrencyCell value={r.selling} color="text-orange-400" />
              <CurrencyCell value={r.admin} color="text-yellow-500" />
              <CurrencyCell value={r.financial} color="text-purple-500" />
              <CurrencyCell value={r.salary} color="text-blue-500" />
              <CurrencyCell value={r.incoming} color="text-cyan-500" />
              <CurrencyCell value={r.total_cost} color="text-orange-500" bold />
              <td className={`px-3 py-2.5 font-mono font-bold ${r.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                {r.profit >= 0 ? "+" : ""}{formatVND(r.profit)}
              </td>
              <td className="px-3 py-2.5"><MarginBadge value={r.margin} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-secondary/30 font-bold">
            <td className="px-3 py-2.5">TỔNG CỘNG</td>
            <CurrencyCell value={totals.revenue} color="text-green-500" />
            <CurrencyCell value={totals.cogs} color="text-red-400" />
            <CurrencyCell value={totals.selling} color="text-orange-400" />
            <CurrencyCell value={totals.admin} color="text-yellow-500" />
            <CurrencyCell value={totals.financial} color="text-purple-500" />
            <CurrencyCell value={totals.salary} color="text-blue-500" />
            <CurrencyCell value={totals.incoming} color="text-cyan-500" />
            <CurrencyCell value={totals.total_cost} color="text-orange-500" />
            <td className={`px-3 py-2.5 font-mono ${totals.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totals.profit >= 0 ? "+" : ""}{formatVND(totals.profit)}
            </td>
            <td className="px-3 py-2.5"><MarginBadge value={totals.margin} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CurrencyCell({ value, color, bold }: { value: number; color: string; bold?: boolean }) {
  return (
    <td className={`px-3 py-2.5 font-mono ${color} ${bold ? "font-semibold" : ""}`}>
      {formatVND(value)}
    </td>
  );
}

function MarginBadge({ value }: { value: number }) {
  const cls = value >= 20 ? "bg-green-500/10 text-green-600"
    : value >= 0 ? "bg-yellow-500/10 text-yellow-600"
    : "bg-red-500/10 text-red-500";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {value >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {value}%
    </span>
  );
}
