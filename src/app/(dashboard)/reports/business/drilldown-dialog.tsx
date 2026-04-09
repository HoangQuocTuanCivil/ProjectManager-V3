"use client";

import { Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@/components/shared/dialog";
import { formatVND, formatDate } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";
import type { BusinessTotals } from "@/features/revenue/hooks/use-business-report";

/* Loại card mà người dùng có thể click vào */
export type DrilldownType =
  | "revenue"
  | "cost"
  | "salary"
  | "incoming"
  | "profit"
  | null;

interface DrilldownDialogProps {
  type: DrilldownType;
  onClose: () => void;
  dateFrom?: string;
  dateTo?: string;
  totals: BusinessTotals;
}

const supabase = createClient();

const TITLES: Record<Exclude<DrilldownType, null>, string> = {
  revenue: "Chi tiết doanh thu",
  cost: "Chi tiết chi phí",
  salary: "Chi tiết lương",
  incoming: "Chi tiết HĐ giao khoán",
  profit: "Cơ cấu lợi nhuận",
};

const DESCRIPTIONS: Record<Exclude<DrilldownType, null>, string> = {
  revenue: "Tổng doanh thu từ các hợp đồng đầu ra đang hoạt động hoặc hoàn thành",
  cost: "Phân bổ chi phí theo loại: giá vốn, bán hàng, quản lý, tài chính",
  salary: "Bảng lương theo phòng ban và nhân viên",
  incoming: "Hợp đồng đầu vào (giao khoán) đang hoạt động",
  profit: "Tổng hợp doanh thu, chi phí và lợi nhuận",
};

/* ── Các loại dữ liệu trả về từ Supabase ────────────────────── */

interface OutgoingContractRow {
  id: string;
  contract_no: string;
  title: string;
  contract_value: number;
  signed_date: string | null;
  status: string;
  project: { code: string; name: string } | null;
  product_service: { code: string; name: string } | null;
}

interface CostRow {
  id: string;
  category: string;
  amount: number;
  description: string;
  period_start: string | null;
  period_end: string | null;
  project: { code: string; name: string } | null;
  contract: { contract_no: string; title: string } | null;
  department: { name: string; code: string } | null;
}

interface SalaryRow {
  id: string;
  month: string;
  base_salary: number;
  user: { full_name: string } | null;
  department: {
    name: string; code: string;
    center?: { id: string; name: string; code: string } | null;
  } | null;
}

/** Cấu trúc phân cấp: Trung tâm → Phòng ban → tổng lương */
interface CenterGroup {
  id: string;
  name: string;
  code: string;
  total: number;
  depts: { name: string; code: string; total: number }[];
}

interface IncomingRow {
  id: string;
  contract_no: string;
  title: string;
  contract_value: number;
  signed_date: string | null;
  status: string;
  project: { code: string; name: string } | null;
}

/* ── Component chính ─────────────────────────────────────────── */

export function DrilldownDialog({ type, onClose, dateFrom, dateTo, totals }: DrilldownDialogProps) {
  if (!type) return null;

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={TITLES[type]}
        description={DESCRIPTIONS[type]}
        size="3xl"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {type === "revenue" && <RevenueDetail dateFrom={dateFrom} dateTo={dateTo} />}
          {type === "cost" && <CostDetail dateFrom={dateFrom} dateTo={dateTo} />}
          {type === "salary" && <SalaryDetail dateFrom={dateFrom} dateTo={dateTo} />}
          {type === "incoming" && <IncomingDetail dateFrom={dateFrom} dateTo={dateTo} />}
          {type === "profit" && <ProfitSummary totals={totals} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Loader chung ────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
      <Loader2 size={16} className="animate-spin" />
      Đang tải dữ liệu...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-sm text-muted-foreground">
      Không có dữ liệu trong khoảng thời gian đã chọn
    </div>
  );
}

/* ── Chi tiết Doanh thu = Hợp đồng đầu ra ────────────────────── */

function RevenueDetail({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", "revenue", dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("id, contract_no, title, contract_value, signed_date, status, project:projects(code, name), product_service:product_services(code, name)")
        .eq("contract_type", "outgoing")
        .in("status", ["active", "completed"])
        .order("contract_value", { ascending: false });
      if (dateFrom) q = q.gte("signed_date", dateFrom);
      if (dateTo) q = q.lte("signed_date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as OutgoingContractRow[];
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState />;

  const total = data.reduce((s, r) => s + Number(r.contract_value), 0);
  const statusLabel: Record<string, string> = { active: "Đang thực hiện", completed: "Hoàn thành" };

  return (
    <table className="w-full text-xs whitespace-nowrap">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="text-left px-3 py-2 font-medium">Số HĐ</th>
          <th className="text-left px-3 py-2 font-medium">Tên hợp đồng</th>
          <th className="text-left px-3 py-2 font-medium">Dự án</th>
          <th className="text-left px-3 py-2 font-medium">Sản phẩm/DV</th>
          <th className="text-left px-3 py-2 font-medium">Ngày ký</th>
          <th className="text-left px-3 py-2 font-medium">Trạng thái</th>
          <th className="text-right px-3 py-2 font-medium">Giá trị HĐ</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
            <td className="px-3 py-2 font-medium">{r.contract_no}</td>
            <td className="px-3 py-2 max-w-[200px] truncate" title={r.title}>{r.title}</td>
            <td className="px-3 py-2">{r.project?.code || "—"}</td>
            <td className="px-3 py-2">{r.product_service?.name || "—"}</td>
            <td className="px-3 py-2">{formatDate(r.signed_date)}</td>
            <td className="px-3 py-2">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                r.status === "completed"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                {statusLabel[r.status] || r.status}
              </span>
            </td>
            <td className="px-3 py-2 text-right font-mono text-green-500">{formatVND(r.contract_value)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-secondary/30 font-bold">
          <td className="px-3 py-2" colSpan={6}>TỔNG ({data.length} hợp đồng)</td>
          <td className="px-3 py-2 text-right font-mono text-green-500">{formatVND(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ── Chi tiết Chi phí ────────────────────────────────────────── */

const COST_LABELS: Record<string, string> = {
  cogs: "Giá vốn hàng bán",
  selling: "Chi phí bán hàng",
  admin: "Chi phí quản lý",
  financial: "Chi phí tài chính",
};

function CostDetail({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", "cost", dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("cost_entries")
        .select("id, category, amount, description, period_start, period_end, project:projects(code, name), contract:contracts(contract_no, title), department:departments(name, code)")
        .order("category")
        .order("amount", { ascending: false });
      if (dateFrom) q = q.gte("period_start", dateFrom);
      if (dateTo) q = q.lte("period_end", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as CostRow[];
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState />;

  const total = data.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <table className="w-full text-xs whitespace-nowrap">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="text-left px-3 py-2 font-medium">Loại CP</th>
          <th className="text-left px-3 py-2 font-medium">Dự án</th>
          <th className="text-left px-3 py-2 font-medium">Hợp đồng</th>
          <th className="text-left px-3 py-2 font-medium">Phòng ban</th>
          <th className="text-left px-3 py-2 font-medium">Mô tả</th>
          <th className="text-left px-3 py-2 font-medium">Kỳ</th>
          <th className="text-right px-3 py-2 font-medium">Số tiền</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
            <td className="px-3 py-2">
              <span className="inline-flex px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-medium">
                {COST_LABELS[r.category] || r.category}
              </span>
            </td>
            <td className="px-3 py-2">{r.project?.code || "—"}</td>
            <td className="px-3 py-2 max-w-[140px] truncate" title={r.contract?.title}>
              {r.contract?.contract_no || "—"}
            </td>
            <td className="px-3 py-2">{r.department?.name || "—"}</td>
            <td className="px-3 py-2 max-w-[150px] truncate" title={r.description}>
              {r.description || "—"}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {r.period_start ? `${formatDate(r.period_start)} → ${formatDate(r.period_end)}` : "—"}
            </td>
            <td className="px-3 py-2 text-right font-mono text-red-400">{formatVND(r.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-secondary/30 font-bold">
          <td className="px-3 py-2" colSpan={6}>TỔNG ({data.length} khoản chi)</td>
          <td className="px-3 py-2 text-right font-mono text-red-400">{formatVND(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ── Chi tiết Lương ──────────────────────────────────────────── */

function SalaryDetail({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", "salary", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ per_page: "500" });
      const res = await fetch(`/api/salary?${params}`);
      if (!res.ok) throw new Error("Không tải được dữ liệu lương");
      const json = await res.json();
      let rows = (json.data ?? []) as SalaryRow[];
      if (dateFrom) rows = rows.filter((r) => r.month >= dateFrom);
      if (dateTo) rows = rows.filter((r) => r.month <= dateTo);
      return rows;
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState />;

  /* Nhóm bản ghi lương theo Trung tâm → Phòng ban */
  const groups = useMemo(() => {
    const centerMap = new Map<string, CenterGroup>();
    const NO_CENTER = "__none__";

    for (const r of data) {
      const center = r.department?.center;
      const cId = center?.id ?? NO_CENTER;
      const cName = center?.name ?? "Khác";
      const cCode = center?.code ?? "";
      const dName = r.department?.name ?? "Chưa phân bổ";
      const dCode = r.department?.code ?? "";
      const dKey = `${cId}:${dCode || dName}`;

      if (!centerMap.has(cId)) {
        centerMap.set(cId, { id: cId, name: cName, code: cCode, total: 0, depts: [] });
      }
      const group = centerMap.get(cId)!;
      const salary = Number(r.base_salary);
      group.total += salary;

      let dept = group.depts.find((d) => `${cId}:${d.code || d.name}` === dKey);
      if (!dept) {
        dept = { name: dName, code: dCode, total: 0 };
        group.depts.push(dept);
      }
      dept.total += salary;
    }

    /* Sắp xếp: trung tâm theo tổng lương giảm dần, phòng ban trong mỗi TT cũng vậy */
    const result = Array.from(centerMap.values()).sort((a, b) => b.total - a.total);
    for (const g of result) g.depts.sort((a, b) => b.total - a.total);
    return result;
  }, [data]);

  const total = data.reduce((s, r) => s + Number(r.base_salary), 0);

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="text-left px-3 py-2 font-medium">Trung tâm / Phòng ban</th>
          <th className="text-right px-3 py-2 font-medium">Tổng lương</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.id}>
            {/* Dòng trung tâm: tổng lương của tất cả phòng ban thuộc trung tâm */}
            <tr className="bg-secondary/30 border-t border-border">
              <td className="px-3 py-2.5 font-bold">
                {g.name}
                {g.code && <span className="ml-1.5 text-muted-foreground text-[10px] font-normal">{g.code}</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-500">{formatVND(g.total)}</td>
            </tr>
            {/* Dòng phòng ban: chi tiết lương từng phòng thuộc trung tâm */}
            {g.depts.map((d) => (
              <tr key={`${g.id}-${d.code || d.name}`} className="hover:bg-secondary/10 transition-colors border-b border-border/20">
                <td className="px-3 py-2 pl-8 text-muted-foreground">
                  {d.name}
                  {d.code && <span className="ml-1.5 text-[10px]">{d.code}</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-blue-400">{formatVND(d.total)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-secondary/30 font-bold">
          <td className="px-3 py-2.5">TỔNG CỘNG</td>
          <td className="px-3 py-2.5 text-right font-mono text-blue-500">{formatVND(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ── Chi tiết HĐ giao khoán ─────────────────────────────────── */

function IncomingDetail({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", "incoming", dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("id, contract_no, title, contract_value, signed_date, status, project:projects(code, name)")
        .eq("contract_type", "incoming")
        .in("status", ["active", "completed"])
        .order("signed_date", { ascending: false });
      if (dateFrom) q = q.gte("signed_date", dateFrom);
      if (dateTo) q = q.lte("signed_date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as IncomingRow[];
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState />;

  const total = data.reduce((s, r) => s + Number(r.contract_value), 0);

  const statusLabel: Record<string, string> = { active: "Đang thực hiện", completed: "Hoàn thành" };

  return (
    <table className="w-full text-xs whitespace-nowrap">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="text-left px-3 py-2 font-medium">Số HĐ</th>
          <th className="text-left px-3 py-2 font-medium">Tên hợp đồng</th>
          <th className="text-left px-3 py-2 font-medium">Dự án</th>
          <th className="text-left px-3 py-2 font-medium">Ngày ký</th>
          <th className="text-left px-3 py-2 font-medium">Trạng thái</th>
          <th className="text-right px-3 py-2 font-medium">Giá trị HĐ</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
            <td className="px-3 py-2 font-medium">{r.contract_no}</td>
            <td className="px-3 py-2 max-w-[200px] truncate" title={r.title}>{r.title}</td>
            <td className="px-3 py-2">{r.project?.code || "—"}</td>
            <td className="px-3 py-2">{formatDate(r.signed_date)}</td>
            <td className="px-3 py-2">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                r.status === "completed"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                {statusLabel[r.status] || r.status}
              </span>
            </td>
            <td className="px-3 py-2 text-right font-mono text-cyan-500">{formatVND(r.contract_value)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-secondary/30 font-bold">
          <td className="px-3 py-2" colSpan={5}>TỔNG ({data.length} hợp đồng)</td>
          <td className="px-3 py-2 text-right font-mono text-cyan-500">{formatVND(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ── Tổng hợp Lợi nhuận (P&L rút gọn) ──────────────────────── */

function ProfitSummary({ totals }: { totals: BusinessTotals }) {
  const directCost = totals.cogs + totals.selling + totals.admin + totals.financial;

  const lines: { label: string; value: number; color: string; indent?: boolean; bold?: boolean }[] = [
    { label: "Doanh thu", value: totals.revenue, color: "text-green-500", bold: true },
    { label: "Giá vốn hàng bán", value: -totals.cogs, color: "text-red-400", indent: true },
    { label: "Chi phí bán hàng", value: -totals.selling, color: "text-red-400", indent: true },
    { label: "Chi phí quản lý", value: -totals.admin, color: "text-red-400", indent: true },
    { label: "Chi phí tài chính", value: -totals.financial, color: "text-red-400", indent: true },
    { label: "Tổng chi phí trực tiếp", value: -directCost, color: "text-red-500", bold: true },
    { label: "Lương nhân viên", value: -totals.salary, color: "text-blue-500", indent: true },
    { label: "HĐ giao khoán (đầu vào)", value: -totals.incoming, color: "text-cyan-500", indent: true },
    { label: "Tổng chi phí", value: -totals.total_cost, color: "text-orange-500", bold: true },
    { label: "Lợi nhuận", value: totals.profit, color: totals.profit >= 0 ? "text-green-500" : "text-red-500", bold: true },
  ];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-muted-foreground">
          <th className="text-left px-3 py-2 font-medium">Chỉ tiêu</th>
          <th className="text-right px-3 py-2 font-medium">Giá trị</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/30">
        {lines.map((l, i) => (
          <tr
            key={i}
            className={`transition-colors ${l.bold ? "bg-secondary/20" : "hover:bg-secondary/10"}`}
          >
            <td className={`px-3 py-2.5 ${l.indent ? "pl-8" : ""} ${l.bold ? "font-bold" : ""}`}>
              {l.label}
            </td>
            <td className={`px-3 py-2.5 text-right font-mono ${l.color} ${l.bold ? "font-bold" : ""}`}>
              {l.value >= 0 ? "" : "−"}{formatVND(Math.abs(l.value))}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border bg-secondary/30 font-bold">
          <td className="px-3 py-2.5">Tỷ suất lợi nhuận</td>
          <td className={`px-3 py-2.5 text-right font-mono ${totals.margin >= 0 ? "text-green-500" : "text-red-500"}`}>
            {totals.margin}%
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
