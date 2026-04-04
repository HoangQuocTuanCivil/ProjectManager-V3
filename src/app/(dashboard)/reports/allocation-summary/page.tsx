"use client";

import { useAllocationPeriods } from "@/lib/hooks/use-kpi";
import { Section, StatCard, EmptyState, UserAvatar } from "@/components/shared";
import { AllocationTable } from "@/components/kpi";
import { ROLE_CONFIG, formatVND, formatDate } from "@/lib/utils/kpi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", calculated: "#f59e0b", approved: "#10b981", paid: "#6366f1", rejected: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp", calculated: "Đã tính", approved: "Đã duyệt", paid: "Đã chi", rejected: "Từ chối",
};

export default function AllocationSummaryPage() {
  const { data: periods = [] } = useAllocationPeriods();

  const totalFund = periods.reduce((s, p) => s + p.total_fund, 0);
  const approvedFund = periods.filter((p) => p.status === "approved" || p.status === "paid").reduce((s, p) => s + p.total_fund, 0);
  const periodCount = periods.length;

  // Top users by total allocated
  const userTotals = new Map<string, { name: string; role: string; total: number; periods: number }>();
  periods.forEach((p) => {
    (p.results || []).forEach((r: any) => {
      if (!r.user) return;
      const existing = userTotals.get(r.user_id) || { name: r.user.full_name, role: r.user.role, total: 0, periods: 0 };
      existing.total += r.allocated_amount;
      existing.periods++;
      userTotals.set(r.user_id, existing);
    });
  });
  const topUsers = Array.from(userTotals.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total);

  // Chart: fund by period
  const periodChart = [...periods].reverse().slice(0, 12).map((p) => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
    fund: p.total_fund,
    status: p.status,
  }));

  // Chart: top users
  const userChart = topUsers.slice(0, 8).map((u) => ({
    name: u.name.split(" ").pop(),
    amount: u.total,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <button onClick={() => history.back()} className="text-sm text-muted-foreground hover:text-primary mb-2">← Báo cáo</button>
        <h1 className="text-xl font-bold">Báo cáo chia khoán</h1>
        <p className="text-base text-muted-foreground mt-0.5">Tổng hợp các đợt chia khoán và phân bổ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng đợt khoán" value={periodCount} accentColor="hsl(var(--primary))" />
        <StatCard label="Tổng quỹ" value={formatVND(totalFund)} accentColor="#f59e0b" />
        <StatCard label="Đã duyệt/chi" value={formatVND(approvedFund)} accentColor="#10b981" />
        <StatCard label="Nhân viên" value={userTotals.size} accentColor="#3b82f6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Fund by Period */}
        <Section title="Quỹ khoán theo đợt">
          <div className="p-4 h-[300px]">
            {periodChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base text-muted-foreground">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => formatVND(value)}
                  />
                  <Bar dataKey="fund" name="Quỹ khoán" radius={[4, 4, 0, 0]}>
                    {periodChart.map((entry, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[entry.status] || "#38bdf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Top Users */}
        <Section title="Top nhân viên nhận khoán">
          <div className="p-4 h-[300px]">
            {userChart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base text-muted-foreground">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userChart} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => formatVND(value)}
                  />
                  <Bar dataKey="amount" name="Tổng nhận" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Period List */}
      <Section title="Danh sách đợt khoán">
        {periods.length === 0 ? (
          <div className="p-6"><EmptyState icon="💰" title="Chưa có đợt khoán" subtitle="Tạo đợt khoán từ trang KPI" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Tên đợt", "Kỳ", "Chế độ", "Quỹ", "Nhân viên", "Trạng thái"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="px-4 py-2.5 text-base font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">
                      {formatDate(p.period_start)} → {formatDate(p.period_end)}
                    </td>
                    <td className="px-4 py-2.5 text-sm">{p.mode === "per_project" ? "Theo DA" : "Tổng hợp"}</td>
                    <td className="px-4 py-2.5 font-mono text-sm font-bold text-amber-500">{formatVND(p.total_fund)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm">{p.results?.length || 0}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: `${STATUS_COLORS[p.status]}18`, color: STATUS_COLORS[p.status] }}
                      >
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Top Users Table */}
      {topUsers.length > 0 && (
        <Section title="Bảng tổng hợp nhận khoán">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["#", "Nhân viên", "Số đợt", "Tổng nhận", "TB/đợt"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, idx) => (
                  <tr key={u.id} className="border-b border-border/40">
                    <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">#{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={u.name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                        <span className="text-sm font-semibold">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm">{u.periods}</td>
                    <td className="px-4 py-2.5 font-mono text-sm font-bold text-amber-500">{formatVND(u.total)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">{formatVND(Math.round(u.total / u.periods))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
