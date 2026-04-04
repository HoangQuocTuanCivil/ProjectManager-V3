"use client";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useUsers } from "@/lib/hooks/use-users";
import { Section, StatCard, KPIRing, KPIScoreBar, VerdictBadge, UserAvatar, EmptyState } from "@/components/shared";
import { ROLE_CONFIG, VERDICT_CONFIG, KPI_WEIGHTS, getVerdict, formatPercent } from "@/lib/utils/kpi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

export default function KPISummaryPage() {
  const { data: tasks = [] } = useTasks({});
  const { data: users = [] } = useUsers();

  const evaluated = tasks.filter((t) => t.kpi_evaluated_at);
  const totalWeight = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  const avgE = totalWeight > 0 ? Math.round(tasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / totalWeight) : 0;
  const eW = evaluated.reduce((s, t) => s + t.kpi_weight, 0);
  const avgA = eW > 0 ? Math.round(evaluated.reduce((s, t) => s + t.actual_score * t.kpi_weight, 0) / eW) : 0;

  // Component averages
  const compAvg = (field: string, isActual: boolean) => {
    const src = isActual ? evaluated : tasks;
    const w = src.reduce((s, t) => s + t.kpi_weight, 0);
    if (w === 0) return 0;
    return Math.round(src.reduce((s, t) => s + (Number((t as any)[field]) || 0) * t.kpi_weight, 0) / w);
  };

  const radarData = [
    { subject: "Khối lượng", E: compAvg("expect_volume", false), A: compAvg("actual_volume", true) },
    { subject: "Chất lượng", E: compAvg("expect_quality", false), A: compAvg("actual_quality", true) },
    { subject: "Độ khó", E: compAvg("expect_difficulty", false), A: compAvg("actual_difficulty", true) },
    { subject: "Vượt TĐ", E: compAvg("expect_ahead", false), A: compAvg("actual_ahead", true) },
  ];

  // User ranking
  const userRanking = users.map((u: any) => {
    const uTasks = evaluated.filter((t) => t.assignee_id === u.id);
    if (uTasks.length === 0) return null;
    const w = uTasks.reduce((s, t) => s + t.kpi_weight, 0);
    const avgScore = w > 0 ? Math.round(uTasks.reduce((s, t) => s + t.actual_score * t.kpi_weight, 0) / w) : 0;
    const avgExp = w > 0 ? Math.round(uTasks.reduce((s, t) => s + t.expect_score * t.kpi_weight, 0) / w) : 0;
    return { id: u.id, name: u.full_name, role: u.role, tasks: uTasks.length, avgE: avgExp, avgA: avgScore, delta: avgScore - avgExp };
  }).filter(Boolean).sort((a: any, b: any) => b.avgA - a.avgA) as any[];

  // Bar chart for user KPI
  const userChart = userRanking.slice(0, 10).map((u) => ({
    name: u.name.split(" ").pop(),
    E: u.avgE,
    A: u.avgA,
  }));

  // Verdict distribution
  const verdictCounts = (["exceptional", "exceeded", "near_target", "below_target"] as const).map((v) => ({
    verdict: v,
    count: evaluated.filter((t) => getVerdict(t.kpi_variance) === v).length,
    cfg: VERDICT_CONFIG[v],
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <button onClick={() => history.back()} className="text-sm text-muted-foreground hover:text-primary mb-2">← Báo cáo</button>
        <h1 className="text-xl font-bold">Tổng hợp KPI</h1>
        <p className="text-base text-muted-foreground mt-0.5">Phân tích hiệu suất KPI toàn bộ hệ thống</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Tổng tasks" value={tasks.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Đã đánh giá" value={evaluated.length} accentColor="#10b981" />
        <StatCard label="KPI E (TB)" value={avgE} accentColor="hsl(var(--primary))" />
        <StatCard label="KPI A (TB)" value={evaluated.length > 0 ? avgA : "—"} accentColor={avgA >= avgE ? "#10b981" : "#ef4444"} />
        <StatCard label="Δ trung bình" value={evaluated.length > 0 ? `${avgA - avgE >= 0 ? "+" : ""}${avgA - avgE}` : "—"} accentColor={avgA >= avgE ? "#10b981" : "#ef4444"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Radar: E vs A */}
        <Section title="KPI Components: E vs A">
          <div className="p-4 h-[320px]">
            {evaluated.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base text-muted-foreground">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar name="Kỳ vọng (E)" dataKey="E" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Thực tế (A)" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Verdict Distribution */}
        <Section title="Phân bố kết quả">
          <div className="p-4">
            {evaluated.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-base text-muted-foreground">Chưa có dữ liệu</div>
            ) : (
              <div className="space-y-4">
                {verdictCounts.map(({ verdict, count, cfg }) => {
                  const pct = evaluated.length > 0 ? Math.round((count / evaluated.length) * 100) : 0;
                  return (
                    <div key={verdict}>
                      <div className="flex items-center justify-between mb-1">
                        <VerdictBadge verdict={verdict} />
                        <span className="font-mono text-sm">{count} ({pct}%)</span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                      </div>
                    </div>
                  );
                })}

                {/* KPI Component Averages */}
                <div className="pt-4 border-t border-border space-y-2">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Component TB (thực tế)</p>
                  <KPIScoreBar label="Khối lượng" value={compAvg("actual_volume", true)} color="#38bdf8" weight={`${Math.round(KPI_WEIGHTS.volume * 100)}%`} />
                  <KPIScoreBar label="Chất lượng" value={compAvg("actual_quality", true)} color="#10b981" weight={`${Math.round(KPI_WEIGHTS.quality * 100)}%`} />
                  <KPIScoreBar label="Độ khó" value={compAvg("actual_difficulty", true)} color="#f59e0b" weight={`${Math.round(KPI_WEIGHTS.difficulty * 100)}%`} />
                  <KPIScoreBar label="Vượt TĐ" value={compAvg("actual_ahead", true)} color="#8b5cf6" weight={`${Math.round(KPI_WEIGHTS.ahead * 100)}%`} />
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* User E vs A Chart */}
      <Section title="KPI theo nhân viên (E vs A)">
        <div className="p-4 h-[340px]">
          {userChart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-base text-muted-foreground">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userChart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="E" name="Kỳ vọng" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="A" name="Thực tế" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* Ranking Table */}
      <Section title="Bảng xếp hạng KPI">
        {userRanking.length === 0 ? (
          <div className="p-6"><EmptyState icon="🎯" title="Chưa có dữ liệu" subtitle="Nghiệm thu task để có bảng xếp hạng" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["#", "Nhân viên", "Tasks", "KPI E", "KPI A", "Δ", "Kết quả"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userRanking.map((u, idx) => {
                  const verdict = getVerdict(u.delta);
                  return (
                    <tr key={u.id} className="border-b border-border/40 hover:bg-secondary/20">
                      <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">#{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={u.name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                          <span className="text-sm font-semibold">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm">{u.tasks}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1"><KPIRing score={u.avgE} size={24} strokeWidth={2} /><span className="font-mono text-sm">{u.avgE}</span></div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1"><KPIRing score={u.avgA} size={24} strokeWidth={2} /><span className="font-mono text-sm font-bold">{u.avgA}</span></div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm font-bold" style={{ color: u.delta >= 0 ? "#10b981" : "#ef4444" }}>
                        {u.delta >= 0 ? "+" : ""}{u.delta}
                      </td>
                      <td className="px-4 py-2.5"><VerdictBadge verdict={verdict} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
