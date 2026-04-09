"use client";

import { useState, useMemo } from "react";
import {
  useBusinessReport,
  type BusinessRow,
  type BusinessTotals,
} from "@/features/revenue/hooks/use-business-report";
import { formatVND, currentMonthRange } from "@/lib/utils/format";
import { useCenters } from "@/features/organization/hooks/use-teams";
import { Download, TrendingUp, TrendingDown, Building2, Landmark, Package } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DrilldownDialog, type DrilldownType } from "./drilldown-dialog";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

export default function BusinessReportPage() {
  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);

  const dateFilters = useMemo(() => ({
    from: dateFrom || undefined,
    to: dateTo || undefined,
  }), [dateFrom, dateTo]);

  const { data: companyData, isLoading: companyLoading } = useBusinessReport({ group_by: "company", ...dateFilters });
  const { data: centerData, isLoading: centerLoading } = useBusinessReport({ group_by: "center", ...dateFilters });
  const { data: psData, isLoading: psLoading } = useBusinessReport({ group_by: "product_service", ...dateFilters });
  const { data: allCenters = [] } = useCenters();

  const company = companyData?.totals ?? empty();
  const centerRows = centerData?.rows ?? [];
  const centerTotals = centerData?.totals ?? empty();
  const psRows = psData?.rows ?? [];
  const psTotals = psData?.totals ?? empty();

  const isLoading = companyLoading || centerLoading || psLoading;

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const companySheet = [
      { "Chỉ tiêu": "Doanh thu", "Giá trị": company.revenue },
      { "Chỉ tiêu": "Giá vốn", "Giá trị": company.cogs },
      { "Chỉ tiêu": "CP bán hàng", "Giá trị": company.selling },
      { "Chỉ tiêu": "CP quản lý", "Giá trị": company.admin },
      { "Chỉ tiêu": "CP tài chính", "Giá trị": company.financial },
      { "Chỉ tiêu": "Lương", "Giá trị": company.salary },
      { "Chỉ tiêu": "HĐ giao khoán", "Giá trị": company.incoming },
      { "Chỉ tiêu": "Tổng chi phí", "Giá trị": company.total_cost },
      { "Chỉ tiêu": "Lợi nhuận", "Giá trị": company.profit },
      { "Chỉ tiêu": "Tỷ suất LN (%)", "Giá trị": company.margin },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(companySheet), "Toàn công ty");

    const centerSheet = centerRows.map((r) => ({
      "Mã": r.code, "Trung tâm": r.name,
      "Doanh thu": r.revenue, "Lương": r.salary,
      "Lợi nhuận": r.profit, "Tỷ suất (%)": r.margin,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(centerSheet), "Trung tâm");

    const psSheet = psRows.map((r) => ({
      "Mã": r.code, "Sản phẩm DV": r.name,
      "Doanh thu": r.revenue, "Chi phí": r.total_cost - r.incoming,
      "HĐ giao khoán": r.incoming, "Lợi nhuận": r.profit, "Tỷ suất (%)": r.margin,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(psSheet), "Sản phẩm DV");

    XLSX.writeFile(wb, `BC_Kinh_Doanh_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã tải báo cáo Excel");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tổng quan hoạt động sản xuất kinh doanh
        </p>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
          <button onClick={handleExport} disabled={isLoading}
            className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs flex items-center gap-1 transition-colors disabled:opacity-40">
            <Download size={13} /> Xuất Excel
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Đang tải dữ liệu...</div>
      ) : (
        <>
          <CompanySection totals={company} onCardClick={setDrilldown} />
          <CompanyCharts totals={company} centerRows={centerRows} allCenters={allCenters as any[]} />
          <CenterSection rows={centerRows} totals={centerTotals} />
          <ProductServiceSection rows={psRows} totals={psTotals} />
          <DrilldownDialog
            type={drilldown}
            onClose={() => setDrilldown(null)}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
            totals={company}
          />
        </>
      )}
    </div>
  );
}

function CompanySection({ totals, onCardClick }: { totals: BusinessTotals; onCardClick: (type: DrilldownType) => void }) {
  const cards: { label: string; value: number; color: string; pct?: boolean; drilldown: DrilldownType }[] = [
    { label: "Doanh thu", value: totals.revenue, color: "text-green-500", drilldown: "revenue" },
    { label: "Chi phí", value: totals.cogs + totals.selling + totals.admin + totals.financial, color: "text-red-400", drilldown: "cost" },
    { label: "Lương ứng hằng tháng", value: totals.salary, color: "text-blue-500", drilldown: "salary" },
    { label: "HĐ giao khoán", value: totals.incoming, color: "text-cyan-500", drilldown: "incoming" },
    { label: "Lợi nhuận", value: totals.profit, color: totals.profit >= 0 ? "text-green-500" : "text-red-500", drilldown: "profit" },
    { label: "Tỷ suất LN", value: totals.margin, color: totals.margin >= 0 ? "text-green-500" : "text-red-500", pct: true, drilldown: "profit" },
  ];

  return (
    <div>
      <SectionHeader icon={<Building2 size={15} />} title="Toàn công ty" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
        {cards.map((c, i) => (
          <div
            key={i}
            onClick={() => onCardClick(c.drilldown)}
            className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-base font-bold font-mono ${c.color}`}>
              {c.pct ? `${c.value}%` : formatVND(c.value)}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1">Nhấn để xem chi tiết</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyCharts({ totals, centerRows, allCenters }: { totals: BusinessTotals; centerRows: BusinessRow[]; allCenters: { id: string; name: string; code: string }[] }) {
  /* Cơ cấu chi phí: không bao gồm lương (lương là khoản ứng trước cho NV) */
  const costPie = useMemo(() => [
    { name: "Giá vốn", value: totals.cogs },
    { name: "CP bán hàng", value: totals.selling },
    { name: "CP quản lý", value: totals.admin },
    { name: "CP tài chính", value: totals.financial },
    { name: "HĐ giao khoán", value: totals.incoming },
  ].filter((i) => i.value > 0), [totals]);

  /* Biểu đồ SXKD: hiển thị tất cả trung tâm, kể cả giá trị = 0 */
  const centerBar = useMemo(() => {
    const rowMap = new Map(centerRows.map((r) => [r.id, r]));
    return allCenters.map((c) => {
      const r = rowMap.get(c.id);
      return {
        name: c.code || c.name.slice(0, 12),
        "Doanh thu": r?.revenue ?? 0,
        "Lương": r?.salary ?? 0,
        "Lợi nhuận": r?.profit ?? 0,
      };
    });
  }, [centerRows, allCenters]);

  if (!costPie.length && !centerBar.length) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {costPie.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Cơ cấu chi phí toàn công ty</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={costPie} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}
                label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(1)}%`}>
                {costPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {centerBar.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">SXKD theo trung tâm</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={centerBar}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Doanh thu" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lương" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lợi nhuận" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CenterSection({ rows, totals }: { rows: BusinessRow[]; totals: BusinessTotals }) {
  if (!rows.length) return null;

  /* Tỷ suất khoán = Lương tạm ứng / DT nhận khoán × 100% */
  const koanPct = (salary: number, incoming: number) =>
    incoming > 0 ? Math.round((salary / incoming) * 1000) / 10 : 0;

  return (
    <div>
      <SectionHeader icon={<Landmark size={15} />} title="Lợi nhuận theo trung tâm" />
      <div className="bg-card border border-border rounded-xl overflow-x-auto mt-3">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {[
                "Trung tâm", "DT công ty", "Chi phí", "LN về công ty", "Tỷ suất",
                "DT nhận khoán", "Lương tạm ứng", "TS khoán",
              ].map((h) => (
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
                <MoneyTd value={r.revenue} color="text-green-500" />
                <MoneyTd value={r.total_cost} color="text-red-400" />
                <td className={`px-3 py-2.5 font-mono font-bold ${r.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {r.profit >= 0 ? "+" : ""}{formatVND(r.profit)}
                </td>
                <td className="px-3 py-2.5"><MarginBadge value={r.margin} /></td>
                <MoneyTd value={r.incoming} color="text-cyan-500" />
                <MoneyTd value={r.salary} color="text-blue-500" />
                <td className="px-3 py-2.5"><MarginBadge value={koanPct(r.salary, r.incoming)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/30 font-bold">
              <td className="px-3 py-2.5">TỔNG CỘNG</td>
              <MoneyTd value={totals.revenue} color="text-green-500" />
              <MoneyTd value={totals.total_cost} color="text-red-400" />
              <td className={`px-3 py-2.5 font-mono ${totals.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totals.profit >= 0 ? "+" : ""}{formatVND(totals.profit)}
              </td>
              <td className="px-3 py-2.5"><MarginBadge value={totals.margin} /></td>
              <MoneyTd value={totals.incoming} color="text-cyan-500" />
              <MoneyTd value={totals.salary} color="text-blue-500" />
              <td className="px-3 py-2.5"><MarginBadge value={koanPct(totals.salary, totals.incoming)} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ProductServiceSection({ rows, totals: psTotals }: { rows: BusinessRow[]; totals: BusinessTotals }) {
  if (!rows.length) return null;

  const barData = useMemo(() =>
    rows.slice(0, 8).map((r) => ({
      name: r.code || r.name.slice(0, 12),
      "Doanh thu": r.revenue,
      "Chi phí + GK": r.total_cost,
      "Lợi nhuận": r.profit,
    })),
  [rows]);

  return (
    <div>
      <SectionHeader icon={<Package size={15} />} title="Lợi nhuận theo sản phẩm / dịch vụ" />

      {barData.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-4 mt-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatVND(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Doanh thu" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Chi phí + GK" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lợi nhuận" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto mt-3">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {["Sản phẩm/DV", "Doanh thu", "Chi phí", "HĐ giao khoán", "Tổng CP", "Lợi nhuận", "Tỷ suất"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r) => {
              const directCost = r.cogs + r.selling + r.admin + r.financial;
              return (
                <tr key={r.id} className={`hover:bg-secondary/20 transition-colors ${r.profit < 0 ? "bg-red-500/5" : ""}`}>
                  <td className="px-3 py-2.5 font-medium">
                    {r.name}
                    {r.code && <span className="ml-1.5 text-muted-foreground text-[10px]">{r.code}</span>}
                  </td>
                  <MoneyTd value={r.revenue} color="text-green-500" />
                  <MoneyTd value={directCost} color="text-red-400" />
                  <MoneyTd value={r.incoming} color="text-cyan-500" />
                  <MoneyTd value={r.total_cost} color="text-orange-500" bold />
                  <td className={`px-3 py-2.5 font-mono font-bold ${r.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {r.profit >= 0 ? "+" : ""}{formatVND(r.profit)}
                  </td>
                  <td className="px-3 py-2.5"><MarginBadge value={r.margin} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/30 font-bold">
              <td className="px-3 py-2.5">TỔNG CỘNG</td>
              <MoneyTd value={psTotals.revenue} color="text-green-500" />
              <MoneyTd value={psTotals.cogs + psTotals.selling + psTotals.admin + psTotals.financial} color="text-red-400" />
              <MoneyTd value={psTotals.incoming} color="text-cyan-500" />
              <MoneyTd value={psTotals.total_cost} color="text-orange-500" />
              <td className={`px-3 py-2.5 font-mono ${psTotals.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                {psTotals.profit >= 0 ? "+" : ""}{formatVND(psTotals.profit)}
              </td>
              <td className="px-3 py-2.5"><MarginBadge value={psTotals.margin} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
  );
}

function MoneyTd({ value, color, bold }: { value: number; color: string; bold?: boolean }) {
  return <td className={`px-3 py-2.5 font-mono ${color} ${bold ? "font-semibold" : ""}`}>{formatVND(value)}</td>;
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

function empty(): BusinessTotals {
  return { revenue: 0, cogs: 0, selling: 0, admin: 0, financial: 0, salary: 0, incoming: 0, total_cost: 0, profit: 0, margin: 0 };
}
