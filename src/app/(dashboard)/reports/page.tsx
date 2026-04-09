"use client";

import { useState, useMemo } from "react";

import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useAllocationPeriods } from "@/lib/hooks/use-kpi";
import { useUsers } from "@/lib/hooks/use-users";
import { StatCard, Section, ProgressBar, TrendIndicator, AlertCard, StatusBadge, PriorityBadge, UserAvatar } from "@/components/shared";
import { TaskDetail } from "@/components/tasks/task-detail";
import { STATUS_CONFIG, PRIORITY_CONFIG, ROLE_CONFIG, formatVND, getVerdict, VERDICT_CONFIG } from "@/lib/utils/kpi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { Download, Printer, TrendingUp, AlertTriangle, DollarSign, CheckCircle2, BarChart3, Target, Users } from "lucide-react";
import { Button } from "@/components/shared";
import { useI18n } from "@/lib/i18n";
import { currentMonthRange } from "@/lib/utils/format";

const CHART_COLORS = ["#38bdf8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6366f1", "#ec4899", "#94a3b8"];

// Custom label for pie chart
const renderPieLabel = ({ name, percent }: { name: string; percent: number }) => {
  if (percent < 0.05) return null;
  return `${(percent * 100).toFixed(0)}%`;
};

export default function ReportsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data: tasks = [] } = useTasks({});
  const { data: projects = [] } = useProjects();
  const { data: allContracts = [] } = useContracts();
  const { data: periods = [] } = useAllocationPeriods();
  const { data: users = [] } = useUsers();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);

  const dateLocale = locale === "en" ? "en-US" : "vi-VN";

  // Filter tasks by date range (same logic as work-report categorize)
  const filteredTasks = useMemo(() => {
    if (!dateFrom && !dateTo) return tasks;
    const da = dateFrom ? new Date(dateFrom) : new Date(0);
    const db = dateTo ? new Date(dateTo + "T23:59:59") : new Date("2099-12-31");
    return tasks.filter((tk) => {
      // Completed tasks: check completed_at or deadline falls in range
      if (tk.status === "completed" || tk.completed_at) {
        const cd = tk.completed_at ? new Date(tk.completed_at) : null;
        if (cd && cd >= da && cd <= db) return true;
        if (tk.deadline && new Date(tk.deadline) >= da && new Date(tk.deadline) <= db && tk.status === "completed") return true;
      }
      // Future tasks: start_date after range end
      if (tk.start_date && new Date(tk.start_date) > db) return false;
      // Active tasks: overlap with date range
      if (tk.status !== "completed") {
        const ts = tk.start_date ? new Date(tk.start_date) : new Date(tk.created_at);
        const te = tk.deadline ? new Date(tk.deadline) : null;
        if (ts <= db && (!te || te >= da)) return true;
        if (!tk.start_date && !tk.deadline && ["pending", "in_progress", "review", "overdue"].includes(tk.status)) return true;
      }
      return false;
    });
  }, [tasks, dateFrom, dateTo]);

  //  Aggregations 
  const statusData = (["pending", "in_progress", "review", "completed", "overdue"] as const).map((s) => ({
    name: STATUS_CONFIG[s].label,
    value: filteredTasks.filter((tk) => tk.status === s).length,
    color: STATUS_CONFIG[s].color,
  }));

  const priorityData = (["low", "medium", "high", "urgent"] as const).map((p) => ({
    name: PRIORITY_CONFIG[p].label,
    value: filteredTasks.filter((tk) => tk.priority === p).length,
    color: PRIORITY_CONFIG[p].color,
  }));

  const evaluated = filteredTasks.filter((tk) => tk.kpi_evaluated_at);
  const verdictData = (["exceptional", "exceeded", "near_target", "below_target"] as const).map((v) => ({
    name: VERDICT_CONFIG[v].label,
    value: evaluated.filter((tk) => getVerdict(tk.kpi_variance) === v).length,
    color: VERDICT_CONFIG[v].color,
  }));

  const projectData = projects.slice(0, 8).map((p) => {
    const pTasks = filteredTasks.filter((tk) => tk.project_id === p.id);
    const completed = pTasks.filter((tk) => tk.status === "completed").length;
    const progress = pTasks.length > 0 ? Math.round(pTasks.reduce((s, tk) => s + (tk.progress || 0), 0) / pTasks.length) : 0;
    return { name: p.code, tasks: pTasks.length, completed, progress };
  });

  const contractsByProject = useMemo(() => {
    const budgetMap = new Map<string, number>();
    const fundMap = new Map<string, number>();
    for (const c of (allContracts as any[])) {
      if (!["active", "completed"].includes(c.status)) continue;
      const val = Number(c.contract_value);
      if (c.contract_type === "outgoing") budgetMap.set(c.project_id, (budgetMap.get(c.project_id) || 0) + val);
      else if (c.contract_type === "incoming") fundMap.set(c.project_id, (fundMap.get(c.project_id) || 0) + val);
    }
    return { budgetMap, fundMap };
  }, [allContracts]);
  const totalBudget = projects.reduce((s, p) => s + (contractsByProject.budgetMap.get(p.id) || 0), 0);
  const totalFund = projects.reduce((s, p) => s + (contractsByProject.fundMap.get(p.id) || 0), 0);
  const totalPaid = periods.filter((p) => p.status === "paid" || p.status === "approved").reduce((s, p) => s + p.total_fund, 0);

  //  Enhanced Metrics (use filteredTasks so date filter applies) 
  const completedTasks = filteredTasks.filter((tk) => tk.status === "completed").length;
  const overallProgress = filteredTasks.length > 0 ? Math.round(filteredTasks.reduce((s, tk) => s + (tk.progress || 0), 0) / filteredTasks.length) : 0;
  const overdueTasks = filteredTasks.filter((tk) => tk.status === "overdue").length;
  const budgetUsedPct = totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0;

  // Trend: compare completed this week vs last week
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const completedThisWeek = filteredTasks.filter((tk) => tk.completed_at && new Date(tk.completed_at) >= thisWeekStart).length;
  const completedLastWeek = filteredTasks.filter((tk) => tk.completed_at && new Date(tk.completed_at) >= lastWeekStart && new Date(tk.completed_at) < thisWeekStart).length;
  const completionTrend = completedLastWeek > 0 ? Math.round(((completedThisWeek - completedLastWeek) / completedLastWeek) * 100) : 0;

  // Risk alerts
  const riskyTasks = useMemo(() => {
    const now = new Date();
    return filteredTasks.filter((tk) => {
      if (tk.status === "completed") return false;
      if (!tk.deadline) return false;
      const dl = new Date(tk.deadline);
      const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
      return daysLeft <= 3 && (tk.progress || 0) < 50;
    });
  }, [filteredTasks]);

  // All risk tasks: overdue + near-deadline, sorted by urgency, top 5
  const allRiskTasks = useMemo(() => {
    const now = new Date();
    return filteredTasks
      .filter((tk) => {
        if (tk.status === "completed" || tk.status === "cancelled") return false;
        if (tk.status === "overdue") return true;
        if (!tk.deadline) return false;
        const dl = new Date(tk.deadline);
        const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
        return daysLeft <= 3 && (tk.progress || 0) < 50;
      })
      .sort((a, b) => {
        const dlA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const dlB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return dlA - dlB;
      })
      .slice(0, 5);
  }, [filteredTasks]);

  //  Report cards 
  const reportCards = [
    { href: "/reports/work-report", icon: "📋", title: t.reports.workReport, desc: t.reports.workReportDesc },
    { href: "/reports/business", icon: "📊", title: t.reports.businessReport, desc: t.reports.businessReportDesc },
    { href: "/reports/kpi-summary", icon: "🎯", title: t.reports.kpiSummary, desc: t.reports.kpiSummaryDesc },
    { href: "/reports/allocation-summary", icon: "💰", title: t.reports.allocationReport, desc: t.reports.allocationReportDesc },
  ];

  //  Export to Excel 
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tasks (filtered by date range)
    const taskRows = filteredTasks.map((tk) => ({
      [t.reports.taskName]: tk.title,
      [t.reports.statusCol]: STATUS_CONFIG[tk.status]?.label || tk.status,
      [t.reports.priorityCol]: PRIORITY_CONFIG[tk.priority]?.label || tk.priority,
      [t.reports.projectCol]: tk.project?.code || "",
      [t.reports.assigneeCol]: tk.assignee?.full_name || "",
      [t.reports.progressCol]: tk.progress,
      [t.reports.kpiExpectedCol]: Math.round(tk.expect_score),
      [t.reports.kpiActualCol]: tk.kpi_evaluated_at ? Math.round(tk.actual_score) : "",
      "Deadline": tk.deadline || "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "Tasks");

    // Sheet 2: Projects
    const projRows = projects.map((p) => {
      const pTasks = filteredTasks.filter((tk) => tk.project_id === p.id);
      const progress = pTasks.length > 0 ? Math.round(pTasks.reduce((s, tk) => s + (tk.progress || 0), 0) / pTasks.length) : 0;
      return {
        [t.reports.projectCode]: p.code,
        [t.reports.projectName]: p.name,
        [t.reports.totalTasks]: pTasks.length,
        [t.reports.completedCol]: pTasks.filter((tk) => tk.status === "completed").length,
        [t.reports.progressCol]: progress,
        [t.reports.budgetCol]: contractsByProject.budgetMap.get(p.id) || 0,
        [t.reports.fundCol]: contractsByProject.fundMap.get(p.id) || 0,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projRows), "Projects");

    // Sheet 3: KPI by User
    const userKPI = users.map((u: any) => {
      const uTasks = filteredTasks.filter((tk) => tk.assignee_id === u.id);
      const evald = uTasks.filter((tk) => tk.kpi_evaluated_at);
      const totalW = uTasks.reduce((s, tk) => s + tk.kpi_weight, 0);
      const avgE = totalW > 0 ? Math.round(uTasks.reduce((s, tk) => s + tk.expect_score * tk.kpi_weight, 0) / totalW) : 0;
      const evalW = evald.reduce((s, tk) => s + tk.kpi_weight, 0);
      const avgA = evalW > 0 ? Math.round(evald.reduce((s, tk) => s + tk.actual_score * tk.kpi_weight, 0) / evalW) : 0;
      return {
        [t.reports.employeeCol]: u.full_name,
        [t.reports.totalTasks]: uTasks.length,
        [t.reports.evaluatedCol]: evald.length,
        [t.reports.avgExpectedCol]: avgE,
        [t.reports.avgActualCol]: evald.length > 0 ? avgA : "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userKPI), "KPI");

    XLSX.writeFile(wb, `A2Z_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  //  Export to PDF 
  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-5 animate-fade-in print-report-container">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold">{t.reports.pageTitle}</h1>
          <p className="text-base text-muted-foreground mt-0.5">{t.reports.pageSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={exportPDF} className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/50">
            <Printer size={16} /> {t.common.exportPdf}
          </Button>
          <Button variant="primary" size="sm" onClick={exportExcel}>
            <Download size={16} /> {t.common.exportExcel}
          </Button>
        </div>
      </div>

      {/* Print Header (Visible only when printing) */}
      <div className="hidden print:block mb-8 text-center border-b pb-4">
        <h1 className="text-2xl font-bold mb-2">{t.reports.exportTitle}</h1>
        <p className="text-gray-500">{t.reports.exportDate} {new Date().toLocaleDateString(dateLocale)}</p>
        {(dateFrom || dateTo) && (
          <p className="text-gray-500 mt-1">
            {t.reports.period} {dateFrom ? new Date(dateFrom).toLocaleDateString(dateLocale) : t.reports.periodStart} - {dateTo ? new Date(dateTo).toLocaleDateString(dateLocale) : t.reports.periodCurrent}
          </p>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">{t.reports.dateRange}</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-sm text-muted-foreground">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-sm text-destructive hover:underline"
          >
            {t.common.clearFilter}
          </button>
        )}
        {(dateFrom || dateTo) && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredTasks.length}/{tasks.length} tasks
          </span>
        )}
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {reportCards.map((r) => (
          <button
            key={r.href}
            onClick={() => router.push(r.href)}
            className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <span className="text-2xl">{r.icon}</span>
            <h3 className="text-base font-bold mt-2 group-hover:text-primary transition-colors">{r.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Enhanced KPI Cards — all clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Overall Progress */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setActivePanel("progress")}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-blue-500" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.overallProgress}</p>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold font-mono text-blue-500">{overallProgress}%</p>
          </div>
          <ProgressBar value={overallProgress} showText={false} className="mt-2" />
        </div>

        {/* Total Tasks */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-primary/60 transition-colors" onClick={() => setActivePanel("totalTasks")}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ background: "hsl(var(--primary))" }} />
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-primary" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.totalTasks}</p>
          </div>
          <p className="text-2xl font-bold font-mono" style={{ color: "hsl(var(--primary))" }}>{filteredTasks.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{completedTasks} {t.reports.completed}</p>
        </div>

        {/* Completed + Trend */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors" onClick={() => setActivePanel("weekly")}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-emerald-500" />
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.weeklyCompleted}</p>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold font-mono text-emerald-500">{completedThisWeek}</p>
            <TrendIndicator value={completionTrend} suffix="%" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{t.reports.lastWeek} {completedLastWeek}</p>
        </div>

        {/* Overdue / At Risk */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-red-400 transition-colors" onClick={() => setShowRiskPanel(true)}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-red-500" />
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.risk}</p>
          </div>
          <p className="text-2xl font-bold font-mono text-red-500">{overdueTasks + riskyTasks.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{t.reports.riskDesc.replace("{count}", String(riskyTasks.length)).replace("overdue", `${overdueTasks} ${t.status.overdue.toLowerCase()}`)}</p>
        </div>

        {/* Budget */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-amber-400 transition-colors" onClick={() => setActivePanel("budget")}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-amber-500" />
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-amber-500" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.budgetCard}</p>
          </div>
          <p className="text-lg font-bold font-mono text-amber-500">{formatVND(totalBudget)}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-[4px] bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${budgetUsedPct}%`, background: budgetUsedPct > 80 ? "#ef4444" : budgetUsedPct > 60 ? "#f59e0b" : "#10b981" }} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{budgetUsedPct}%</span>
          </div>
        </div>

        {/* Staff */}
        <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden cursor-pointer hover:border-violet-400 transition-colors" onClick={() => setActivePanel("staff")}>
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-violet-500" />
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-violet-500" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{t.reports.staffCard}</p>
          </div>
          <p className="text-2xl font-bold font-mono text-violet-500">{users.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{projects.length} {t.reports.activeProjectsCard}</p>
        </div>
      </div>

      {/* Risk Alerts (if any) */}
      {(riskyTasks.length > 0 || overdueTasks > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" /> {t.reports.riskAlerts}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {riskyTasks.slice(0, 4).map((tk) => {
              const dl = new Date(tk.deadline!);
              const daysLeft = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
              const deadlineText = daysLeft <= 0
                ? t.reports.deadlinePast.replace("{days}", String(Math.abs(daysLeft)))
                : t.reports.deadlineLeft.replace("{days}", String(daysLeft));
              return (
                <AlertCard
                  key={tk.id}
                  severity={daysLeft <= 0 ? "critical" : "warning"}
                  icon={daysLeft <= 0 ? "🔴" : "🟡"}
                  title={tk.title}
                  description={`${tk.project?.code || "—"} · ${tk.assignee?.full_name || "—"} · ${deadlineText} · ${tk.progress}%`}
                  onClick={() => setSelectedTaskId(tk.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Task by Status - Pie */}
        <Section title={t.reports.statusDistribution}>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData.filter((d) => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={95}
                  paddingAngle={3} dataKey="value"
                  stroke="none"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {statusData.filter((d) => d.value > 0).map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => [`${value} tasks`, name]}
                />
                <Legend
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  iconSize={10}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* KPI Verdict - Pie */}
        <Section title={t.reports.kpiResults}>
          <div className="p-4 h-[300px]">
            {evaluated.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base text-muted-foreground">{t.common.noData}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verdictData.filter((d) => d.value > 0)}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={95}
                    paddingAngle={3} dataKey="value"
                    stroke="none"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {verdictData.filter((d) => d.value > 0).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value} tasks`, name]}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    iconSize={10}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Project Tasks - Bar */}
        <Section title={t.reports.tasksByProject}>
          <div className="p-4 h-[320px]">
            {projectData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base text-muted-foreground">{t.common.noData}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value} tasks`, name]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="tasks" name={t.common.total} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name={t.status.completed} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        {/* Priority Distribution - Bar */}
        <Section title={t.reports.priorityDistribution}>
          <div className="p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical" barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value} tasks`]}
                />
                <Bar dataKey="value" name="Tasks" radius={[0, 6, 6, 0]}>
                  {priorityData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Project Progress Table */}
      <Section title={t.reports.projectProgress}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {[t.reports.projectCode, t.reports.projectName, t.reports.totalTasks, t.reports.completedCol, t.reports.progressCol].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectData.map((p) => {
                const proj = projects.find((pr) => pr.code === p.name);
                return (
                  <tr key={p.name} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-sm text-primary font-bold">{p.name}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground truncate max-w-[200px]" title={proj?.name || ""}>
                      {proj?.name || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm">{p.tasks}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-green-500">{p.completed}</td>
                    <td className="px-4 py-2.5 w-48">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.progress} />
                        {p.progress >= 80 && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Risk Panel — top 5 risky tasks */}
      {showRiskPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowRiskPanel(false)}>
          <div className="w-[520px] bg-card border-l border-border h-full overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="text-base font-bold">{t.reports.riskAlerts}</h3>
                <span className="text-xs text-muted-foreground bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-medium">
                  {allRiskTasks.length}
                </span>
              </div>
              <button onClick={() => setShowRiskPanel(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">✕</button>
            </div>
            <div className="divide-y divide-border/40">
              {allRiskTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-muted-foreground">{t.dashboard.noOverdue}</p>
                </div>
              ) : (
                allRiskTasks.map((tk) => {
                  const dl = tk.deadline ? new Date(tk.deadline) : null;
                  const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                  return (
                    <div
                      key={tk.id}
                      className="px-5 py-4 hover:bg-secondary/30 cursor-pointer transition-colors"
                      onClick={() => { setShowRiskPanel(false); setSelectedTaskId(tk.id); }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={tk.status} />
                        <PriorityBadge priority={tk.priority} />
                        {daysLeft !== null && (
                          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${daysLeft <= 0 ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"}`}>
                            {daysLeft <= 0
                              ? t.reports.deadlinePast.replace("{days}", String(Math.abs(daysLeft)))
                              : t.reports.deadlineLeft.replace("{days}", String(daysLeft))}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug">{tk.title}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {tk.project && (
                          <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                            {(tk.project as any).code}
                          </span>
                        )}
                        {tk.assignee && (
                          <div className="flex items-center gap-1">
                            <UserAvatar name={(tk.assignee as any).full_name} color={ROLE_CONFIG[(tk.assignee as any).role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                            <span>{(tk.assignee as any).full_name}</span>
                          </div>
                        )}
                        <span className="ml-auto font-mono">{tk.progress}%</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={tk.progress} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat Card Detail Panel */}
      {activePanel && (() => {
        const panelConfig: Record<string, { title: string; icon: any; color: string; tasks: any[]; extra?: React.ReactNode }> = {
          progress: {
            title: t.reports.overallProgress,
            icon: <BarChart3 size={18} className="text-blue-500" />,
            color: "blue",
            tasks: [...filteredTasks].filter((tk) => tk.status !== "cancelled").sort((a, b) => (a.progress || 0) - (b.progress || 0)).slice(0, 5),
            extra: <div className="px-5 py-3 border-b border-border bg-secondary/30"><p className="text-sm">{t.reports.overallProgress}: <span className="font-bold font-mono text-blue-500">{overallProgress}%</span> ({completedTasks}/{filteredTasks.length} {t.reports.completed})</p></div>,
          },
          totalTasks: {
            title: t.reports.totalTasks,
            icon: <Target size={18} className="text-primary" />,
            color: "primary",
            tasks: [...filteredTasks].filter((tk) => tk.status !== "cancelled" && tk.status !== "completed").sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime()).slice(0, 5),
            extra: <div className="px-5 py-3 border-b border-border bg-secondary/30"><p className="text-sm">{t.reports.totalTasks}: <span className="font-bold font-mono">{filteredTasks.length}</span> · {completedTasks} {t.reports.completed}</p></div>,
          },
          weekly: {
            title: t.reports.weeklyCompleted,
            icon: <CheckCircle2 size={18} className="text-emerald-500" />,
            color: "emerald",
            tasks: filteredTasks.filter((tk) => tk.completed_at && new Date(tk.completed_at) >= thisWeekStart).slice(0, 5),
            extra: <div className="px-5 py-3 border-b border-border bg-secondary/30"><p className="text-sm">{t.reports.weeklyCompleted}: <span className="font-bold font-mono text-emerald-500">{completedThisWeek}</span> · {t.reports.lastWeek} {completedLastWeek}</p></div>,
          },
          budget: {
            title: t.reports.budgetCard,
            icon: <DollarSign size={18} className="text-amber-500" />,
            color: "amber",
            tasks: [],
            extra: (
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase font-semibold">{t.reports.budgetCard}</p><p className="text-lg font-bold font-mono text-amber-500 mt-1">{formatVND(totalBudget)}</p></div>
                  <div className="bg-secondary rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase font-semibold">{t.projects.allocationFund}</p><p className="text-lg font-bold font-mono text-emerald-500 mt-1">{formatVND(totalFund)}</p></div>
                </div>
                {projects.filter((p: any) => p.status === "active").map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/30">
                    <div><span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded mr-2">{p.code}</span><span className="text-sm">{p.name}</span></div>
                    <span className="text-sm font-mono text-muted-foreground">{formatVND(contractsByProject.budgetMap.get(p.id) || 0)}</span>
                  </div>
                ))}
              </div>
            ),
          },
          staff: {
            title: t.reports.staffCard,
            icon: <Users size={18} className="text-violet-500" />,
            color: "violet",
            tasks: [],
            extra: (
              <div className="px-5 py-3 space-y-1">
                {(users as any[]).slice(0, 10).map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2.5 py-2 border-b border-border/30">
                    <UserAvatar name={u.full_name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color || '#6b7280'}20`, color: ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color || '#6b7280' }}>
                      {ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.label || u.role}
                    </span>
                  </div>
                ))}
              </div>
            ),
          },
        };
        const cfg = panelConfig[activePanel];
        if (!cfg) return null;
        return (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setActivePanel(null)}>
            <div className="w-[520px] bg-card border-l border-border h-full overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cfg.icon}
                  <h3 className="text-base font-bold">{cfg.title}</h3>
                </div>
                <button onClick={() => setActivePanel(null)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">✕</button>
              </div>
              {cfg.extra}
              {cfg.tasks.length > 0 && (
                <div className="divide-y divide-border/40">
                  {cfg.tasks.map((tk: any) => (
                    <div key={tk.id} className="px-5 py-4 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => { setActivePanel(null); setSelectedTaskId(tk.id); }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusBadge status={tk.status} />
                        <PriorityBadge priority={tk.priority} />
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{tk.progress}%</span>
                      </div>
                      <p className="text-sm font-semibold leading-snug">{tk.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {tk.project && <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{(tk.project as any).code}</span>}
                        {tk.assignee && <span>{(tk.assignee as any).full_name}</span>}
                        {tk.deadline && <span className="ml-auto font-mono">{new Date(tk.deadline).toLocaleDateString(locale === "en" ? "en-US" : "vi-VN")}</span>}
                      </div>
                      <ProgressBar value={tk.progress} className="mt-2" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Task Detail Modal */}
      {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
}
