"use client";

import { useState, useMemo, useEffect } from "react";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useUsers } from "@/lib/hooks/use-users";
import { useAllTeams, useCenters } from "@/lib/hooks/use-teams";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button, ProgressBar, AlertCard, DeadlineCountdown, StatusBadge, PriorityBadge, TrendIndicator } from "@/components/shared";
import { TaskDetail } from "@/components/tasks/task-detail";
import { STATUS_CONFIG, PRIORITY_CONFIG, ROLE_CONFIG } from "@/lib/utils/kpi";
import { Download, Calendar, Clock, CheckCircle2, Rocket, Printer, AlertTriangle, Users, TrendingUp, BarChart3, UsersRound, Landmark } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import type { Task } from "@/lib/types";
import { useAuthStore } from "@/lib/stores";
import { hasMinRole } from "@/lib/utils/permissions";


function getMonday(d: Date) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r.toISOString().slice(0, 10); }
function getSunday(d: Date) { const r = new Date(d); r.setDate(r.getDate() + (7 - r.getDay()) % 7); return r.toISOString().slice(0, 10); }
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "—"; }
function fmtFull(d: string) { return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function money(n: number | null | undefined) { const v = typeof n === "number" && Number.isFinite(n) ? n : 0; return v.toLocaleString("vi-VN") + " ₫"; }

type Cat = "wip" | "done" | "future";

function categorize(t: Task, a: string, b: string): Cat | null {
  const da = new Date(a), db = new Date(b + "T23:59:59");
  if (t.status === "completed" || t.completed_at) {
    const cd = t.completed_at ? new Date(t.completed_at) : null;
    if (cd && cd >= da && cd <= db) return "done";
    if (t.deadline && new Date(t.deadline) >= da && new Date(t.deadline) <= db && t.status === "completed") return "done";
  }
  if (t.start_date && new Date(t.start_date) > db) return "future";
  if (t.status !== "completed") {
    const ts = t.start_date ? new Date(t.start_date) : new Date(t.created_at);
    const te = t.deadline ? new Date(t.deadline) : null;
    if (ts <= db && (!te || te >= da)) return "wip";
    if (!t.start_date && !t.deadline && ["pending", "in_progress", "review"].includes(t.status)) return "wip";
  }
  return null;
}

const CAT = {
  wip:    { label: "Đang triển khai", icon: Clock,        color: "#f59e0b" },
  done:   { label: "Đã hoàn thành",   icon: CheckCircle2, color: "#10b981" },
  future: { label: "Tương lai",        icon: Rocket,      color: "#8b5cf6" },
};


const printCSS = `
@media print {
  @page { size: A3 landscape; margin: 10mm; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .print-hide { display: none !important; }
  .print-report { 
    width: 100% !important; 
    max-width: none !important;
    font-size: 10px !important;
  }
  .print-report table { page-break-inside: auto; }
  .print-report tr { page-break-inside: avoid; }
  .print-report .recharts-wrapper { max-height: 180px !important; }
  .print-report h1 { font-size: 16px !important; }
  .print-report h2 { font-size: 12px !important; }
}
`;


export default function WorkReportPage() {
  const { data: tasks = [] } = useTasks({});
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: allTeams = [] } = useAllTeams();
  const { data: allCenters = [] } = useCenters();
  const me = useAuthStore((s) => s.user);
  const now = new Date();

  const [dateFrom, setDateFrom] = useState(getMonday(now));
  const [dateTo, setDateTo] = useState(getSunday(now));
  const [reportKind, setReportKind] = useState<"exec" | "staff">("exec");
  const [deptId, setDeptId] = useState<string>("all");
  const [centerId, setCenterId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");
  const [teamId, setTeamId] = useState<string>("all");
  const [kpiDrill, setKpiDrill] = useState<"progress" | "budget" | "people" | "alerts" | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [staffDrill, setStaffDrill] = useState<"progress" | "completed" | "ontime" | null>(null);
  const toggleDrill = (k: typeof kpiDrill) => setKpiDrill((prev) => prev === k ? null : k);

  const setThisWeek = () => { setDateFrom(getMonday(now)); setDateTo(getSunday(now)); };
  const setLastWeek = () => { const d = new Date(now); d.setDate(d.getDate() - 7); setDateFrom(getMonday(d)); setDateTo(getSunday(d)); };
  const setThisMonth = () => { setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)); setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)); };

  const canViewExec = !!me?.role && hasMinRole(me.role, "head");
  const canChooseDept = !!me?.role && hasMinRole(me.role, "leader");
  useEffect(() => {
    if (!canChooseDept && me?.dept_id) setDeptId(me.dept_id);
  }, [canChooseDept, me?.dept_id]);

  useEffect(() => {
    if (reportKind === "exec" && !canViewExec) setReportKind("staff");
  }, [reportKind, canViewExec]);

  // Fetch ALL departments directly (not scoped by user role) for reliable center filtering
  const { data: allDepts = [] } = useQuery({
    queryKey: ["all-departments-report"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("departments").select("id, name, code, center_id").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const deptOptions = allDepts;

  //  Center filter options 
  const centerOptions = useMemo(() => {
    return (allCenters as any[]).filter((c: any) => c.is_active !== false).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [allCenters]);

  //  Dept options filtered by center 
  const deptOptionsFiltered = useMemo(() => {
    if (centerId === "all") return deptOptions;
    return deptOptions.filter((d: any) => d.center_id === centerId);
  }, [deptOptions, centerId]);

  useEffect(() => {
    if (centerId === "all") return;
    if (deptId === "all") return;
    if (deptOptionsFiltered.some((d: any) => d.id === deptId)) return;
    setDeptId("all");
  }, [centerId, deptId, deptOptionsFiltered]);

  const tasksScoped = useMemo(() => {
    let result = tasks;
    if (centerId !== "all") {
      const centerDeptIds = new Set(deptOptionsFiltered.map((d: any) => d.id));
      result = result.filter((t) => {
        // Match by dept_id in center's departments
        if (t.dept_id && centerDeptIds.has(t.dept_id)) return true;
        // Also match by department's center relation
        if ((t.department as any)?.center_id === centerId) return true;
        if ((t.department as any)?.center?.id === centerId) return true;
        return false;
      });
    }
    if (deptId !== "all") {
      result = result.filter((t) => t.dept_id === deptId);
    }
    return result;
  }, [tasks, deptId, centerId, deptOptionsFiltered]);

  const projectsScoped = useMemo(() => {
    let result = projects;
    if (centerId !== "all") {
      const centerDeptIds = new Set(deptOptionsFiltered.map((d: any) => d.id));
      // Also get project IDs from scoped tasks
      const scopedProjectIds = new Set(tasksScoped.filter((t) => t.project_id).map((t) => t.project_id));
      result = result.filter((p: any) => {
        if (scopedProjectIds.has(p.id)) return true;
        if (centerDeptIds.has(p.dept_id || "")) return true;
        return (p.departments || []).some((pd: any) => centerDeptIds.has(pd?.dept?.id));
      });
    }
    if (deptId !== "all") {
      result = result.filter((p: any) => {
        if (p.dept_id === deptId) return true;
        return (p.departments || []).some((pd: any) => pd?.dept?.id === deptId);
      });
    }
    return result;
  }, [projects, deptId, centerId, deptOptionsFiltered, tasksScoped]);

  //  Team filter options (scoped by center + dept) 
  const teamOptions = useMemo(() => {
    let result = allTeams.filter((t: any) => t.is_active !== false);
    if (centerId !== "all") {
      const centerDeptIds = deptOptionsFiltered.map((d: any) => d.id);
      result = result.filter((t: any) => centerDeptIds.includes(t.dept_id));
    }
    if (deptId !== "all") {
      result = result.filter((t: any) => t.dept_id === deptId);
    }
    return result;
  }, [allTeams, deptId, centerId, deptOptionsFiltered]);

  useEffect(() => {
    if (teamId === "all") return;
    if (teamOptions.some((t: any) => t.id === teamId)) return;
    setTeamId("all");
  }, [teamId, teamOptions]);

  //  Filter by team (before project) 
  const tasksFilteredByTeam = useMemo(() => {
    if (teamId === "all") return tasksScoped;
    return tasksScoped.filter((t: any) => t.team_id === teamId);
  }, [tasksScoped, teamId]);

  //  Project options (scoped by center + dept + team) 
  const projectOptions = useMemo(() => {
    // Get project IDs from filtered tasks
    const taskProjectIds = new Set(tasksFilteredByTeam.filter((t) => t.project_id).map((t) => t.project_id));
    return projectsScoped
      .filter((p: any) => taskProjectIds.has(p.id))
      .map((p: any) => ({ id: p.id, code: p.code, name: p.name }))
      .sort((a: any, b: any) => (a.code || "").localeCompare(b.code || "", "vi"));
  }, [projectsScoped, tasksFilteredByTeam]);

  useEffect(() => {
    if (projectId === "all") return;
    if (projectOptions.some((p: any) => p.id === projectId)) return;
    setProjectId("all");
  }, [projectId, projectOptions]);

  //  Final filter: by project 
  const tasksFiltered = useMemo(() => {
    if (projectId === "all") return tasksFilteredByTeam;
    return tasksFilteredByTeam.filter((t) => t.project_id === projectId);
  }, [tasksFilteredByTeam, projectId]);

  const projectsFiltered = useMemo(() => {
    if (projectId === "all") return projectsScoped;
    return projectsScoped.filter((p: any) => p.id === projectId);
  }, [projectsScoped, projectId]);

  // Categorize
  const cats = useMemo(() => {
    const r = { wip: [] as Task[], done: [] as Task[], future: [] as Task[] };
    if (!dateFrom || !dateTo) return r;
    tasksFiltered.forEach((t) => { const c = categorize(t, dateFrom, dateTo); if (c) r[c].push(t); });
    return r;
  }, [tasksFiltered, dateFrom, dateTo]);

  const total = cats.wip.length + cats.done.length + cats.future.length;

  // Group by person
  const byPerson = useMemo(() => {
    const m = new Map<string, { user: any; wip: Task[]; done: Task[]; future: Task[] }>();
    const all = [...cats.wip, ...cats.done, ...cats.future];
    all.forEach((t) => {
      const uid = t.assignee_id || "_none";
      if (!m.has(uid)) {
        const u = t.assignee || users.find((u: any) => u.id === uid) || { id: uid, full_name: "Chưa giao", role: "staff" };
        m.set(uid, { user: u, wip: [], done: [], future: [] });
      }
      const c = categorize(t, dateFrom, dateTo);
      if (c) m.get(uid)![c].push(t);
    });
    return Array.from(m.values()).sort((a, b) => (b.wip.length + b.done.length + b.future.length) - (a.wip.length + a.done.length + a.future.length));
  }, [cats, users, dateFrom, dateTo]);

  // Group by project
  const byProject = useMemo(() => {
    const m = new Map<string, { project: any; wip: Task[]; done: Task[]; future: Task[] }>();
    const all = [...cats.wip, ...cats.done, ...cats.future];
    all.forEach((t) => {
      const pid = t.project_id || "_none";
      if (!m.has(pid)) {
        const p = t.project || projectsFiltered.find((p: any) => p.id === pid) || { id: pid, code: "—", name: "Không có DA" };
        m.set(pid, { project: p, wip: [], done: [], future: [] });
      }
      const c = categorize(t, dateFrom, dateTo);
      if (c) m.get(pid)![c].push(t);
    });
    return Array.from(m.values()).sort((a, b) => (b.wip.length + b.done.length + b.future.length) - (a.wip.length + a.done.length + a.future.length));
  }, [cats, projectsFiltered, dateFrom, dateTo]);

  const projectMap = useMemo(() => {
    const m = new Map<string, any>();
    projectsFiltered.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [projectsFiltered]);

  const projectSummary = useMemo(() => {
    return byProject.map((g) => {
      const pFull = projectMap.get(g.project.id) || g.project;
      const allTasks = [...g.wip, ...g.done, ...g.future];
      const members = new Map<string, any>();
      allTasks.forEach((t: any) => {
        if (!t.assignee_id) return;
        members.set(t.assignee_id, t.assignee || users.find((u: any) => u.id === t.assignee_id) || { id: t.assignee_id, full_name: "—", role: "staff" });
      });
      const avgProgress = allTasks.length > 0 ? Math.round(allTasks.reduce((s, t) => s + (t.progress || 0), 0) / allTasks.length) : 0;
      return {
        project: pFull,
        wip: g.wip,
        done: g.done,
        future: g.future,
        taskCount: allTasks.length,
        memberCount: members.size,
        members: Array.from(members.values()),
        avgProgress,
      };
    });
  }, [byProject, projectMap, users]);

  const engagedPeople = useMemo(() => {
    const m = new Set<string>();
    [...cats.wip, ...cats.done, ...cats.future].forEach((t) => { if (t.assignee_id) m.add(t.assignee_id); });
    return m.size;
  }, [cats]);

  const financial = useMemo(() => {
    const ids = new Set(projectSummary.map((x) => x.project?.id).filter(Boolean));
    const list = projectsFiltered.filter((p: any) => ids.has(p.id));
    const totalBudget = list.reduce((s: number, p: any) => s + (p.budget || 0), 0);
    const totalFund = list.reduce((s: number, p: any) => s + (p.allocation_fund || 0), 0);
    return { totalBudget, totalFund, projectCount: list.length };
  }, [projectSummary, projectsFiltered]);

  const upcomingProjects = useMemo(() => {
    const to = new Date(dateTo + "T23:59:59");
    return projectsFiltered
      .filter((p: any) => {
        const sd = p.start_date ? new Date(p.start_date) : null;
        if (!sd) return false;
        if (sd <= to) return false;
        return ["planning", "active"].includes(p.status);
      })
      .sort((a: any, b: any) => (a.start_date || "").localeCompare(b.start_date || ""));
  }, [projectsFiltered, dateTo]);

  // Chart data: tasks per person
  const personChartData = byPerson.slice(0, 12).map((p) => ({
    name: p.user.full_name?.split(" ").slice(-2).join(" ") || "N/A",
    "Đang TK": p.wip.length,
    "Hoàn thành": p.done.length,
    "Tương lai": p.future.length,
  }));

  // Pie data: overall distribution
  const pieData = [
    { name: "Đang triển khai", value: cats.wip.length, color: "#f59e0b" },
    { name: "Đã hoàn thành", value: cats.done.length, color: "#10b981" },
    { name: "Tương lai", value: cats.future.length, color: "#8b5cf6" },
  ].filter((d) => d.value > 0);

  //  Risk Detection 
  const riskyTasks = useMemo(() => {
    const n = new Date();
    return [...cats.wip].filter((t) => {
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      const daysLeft = Math.ceil((dl.getTime() - n.getTime()) / 86400000);
      return daysLeft <= 3 && (t.progress || 0) < 50;
    });
  }, [cats.wip]);

  const overdueTasks = useMemo(() => [...cats.wip].filter((t) => t.status === "overdue"), [cats.wip]);

  const overallProgress = useMemo(() => {
    const all = [...cats.wip, ...cats.done, ...cats.future];
    return all.length > 0 ? Math.round(all.reduce((s, t) => s + (t.progress || 0), 0) / all.length) : 0;
  }, [cats]);

  const budgetUsedPct = useMemo(() => {
    return financial.totalBudget > 0 ? Math.round((financial.totalFund / financial.totalBudget) * 100) : 0;
  }, [financial]);

  // Workload: hours per person
  const workloadData = useMemo(() => {
    return byPerson.slice(0, 10).map((p) => {
      const all = [...p.wip, ...p.done, ...p.future];
      const estH = all.reduce((s, t) => s + (t.estimate_hours || 0), 0);
      const actH = all.reduce((s, t) => s + (t.actual_hours || 0), 0);
      return {
        name: p.user.full_name?.split(" ").slice(-2).join(" ") || "N/A",
        "Dự kiến": estH,
        "Thực tế": actH,
        tasks: all.length,
      };
    });
  }, [byPerson]);

  // Project chart data
  const projectChartData = byProject.slice(0, 10).map((p) => ({
    name: p.project.code || "N/A",
    "Đang TK": p.wip.length,
    "Hoàn thành": p.done.length,
    "Tương lai": p.future.length,
  }));

  // Budget utilization per project (for stacked bar chart)
  const budgetChartData = useMemo(() => {
    return projectSummary.slice(0, 8).map((x) => {
      const budget = x.project?.budget || 0;
      const fund = x.project?.allocation_fund || 0;
      return {
        name: x.project?.code || "—",
        "Ngân sách": budget / 1e6,
        "Đã khoán": fund / 1e6,
      };
    }).filter((d) => d["Ngân sách"] > 0 || d["Đã khoán"] > 0);
  }, [projectSummary]);

  // Project health status
  const getProjectHealth = (x: typeof projectSummary[0]): { label: string; color: string } => {
    const overdue = [...x.wip].filter((t) => t.status === "overdue").length;
    const risky = [...x.wip].filter((t) => {
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return Math.ceil((dl.getTime() - now.getTime()) / 86400000) <= 3 && (t.progress || 0) < 50;
    }).length;
    if (overdue > 0) return { label: "At risk", color: "#f59e0b" };
    if (risky > 0) return { label: "Warning", color: "#f59e0b" };
    if (x.avgProgress >= 80) return { label: "On track", color: "#10b981" };
    return { label: "Active", color: "#3b82f6" };
  };

  // Upcoming milestones (tasks with deadlines in next 14 days)
  const upcomingMilestones = useMemo(() => {
    const n = new Date();
    const in14d = new Date(n); in14d.setDate(in14d.getDate() + 14);
    return [...cats.wip, ...cats.future]
      .filter((t) => t.deadline && new Date(t.deadline) >= n && new Date(t.deadline) <= in14d)
      .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))
      .slice(0, 6);
  }, [cats]);

  // Workload heatmap per person
  const workloadHeatmap = useMemo(() => {
    const CAPACITY = 40; // hours per week
    return byPerson.slice(0, 10).map((p) => {
      const all = [...p.wip, ...p.done, ...p.future];
      const estH = all.reduce((s, t) => s + (t.estimate_hours || 0), 0);
      const actH = all.reduce((s, t) => s + (t.actual_hours || 0), 0);
      const hours = actH || estH;
      const pct = CAPACITY > 0 ? Math.round((hours / CAPACITY) * 100) : 0;
      const status = pct > 100 ? "over" : pct >= 70 ? "normal" : "low";
      return {
        name: p.user.full_name || "N/A",
        tasks: all.length,
        hours,
        capacity: CAPACITY,
        pct,
        status,
      };
    });
  }, [byPerson]);

  //  Previous Period (for trends) 
  const prevPeriod = useMemo(() => {
    const fromD = new Date(dateFrom);
    const toD = new Date(dateTo);
    const spanMs = toD.getTime() - fromD.getTime();
    const prevTo = new Date(fromD.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
  }, [dateFrom, dateTo]);

  const prevCats = useMemo(() => {
    const r = { wip: [] as Task[], done: [] as Task[], future: [] as Task[] };
    if (!prevPeriod.from || !prevPeriod.to) return r;
    tasksFiltered.forEach((t) => { const c = categorize(t, prevPeriod.from, prevPeriod.to); if (c) r[c].push(t); });
    return r;
  }, [tasksFiltered, prevPeriod]);

  //  Staff Performance Metrics 
  const staffMetrics = useMemo(() => {
    return byPerson.map((p) => {
      const all = [...p.wip, ...p.done, ...p.future];
      const doneWithDl = p.done.filter((t) => t.deadline && t.completed_at);
      const onTimeCount = doneWithDl.filter((t) => new Date(t.completed_at!) <= new Date(t.deadline! + "T23:59:59")).length;
      const onTimeRate = doneWithDl.length > 0 ? Math.round((onTimeCount / doneWithDl.length) * 100) : null;
      const lateCount = doneWithDl.length - onTimeCount;
      const doneWithDates = p.done.filter((t) => t.completed_at && t.start_date);
      const cycleTimes = doneWithDates.map((t) => Math.max(1, Math.ceil((new Date(t.completed_at!).getTime() - new Date(t.start_date!).getTime()) / 86400000)));
      const avgCycleTime = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((s, v) => s + v, 0) / cycleTimes.length * 10) / 10 : null;
      const evaluated = all.filter((t: any) => t.kpi_evaluated_at);
      const kpiW = evaluated.reduce((s, t) => s + t.kpi_weight, 0);
      const kpiScore = kpiW > 0 ? Math.round(evaluated.reduce((s, t) => s + t.actual_score * t.kpi_weight, 0) / kpiW) : null;
      const avgProgress = all.length > 0 ? Math.round(all.reduce((s, t) => s + (t.progress || 0), 0) / all.length) : 0;
      const overdueCount = p.wip.filter((t) => t.status === "overdue").length;
      return { user: p.user, total: all.length, wip: p.wip.length, done: p.done.length, future: p.future.length, onTimeCount, lateCount, onTimeRate, avgCycleTime, kpiScore, avgProgress, overdueCount };
    }).sort((a, b) => {
      const scoreA = (a.onTimeRate ?? 50) * 0.4 + (a.total > 0 ? a.done / a.total * 100 : 0) * 0.3 + a.avgProgress * 0.3;
      const scoreB = (b.onTimeRate ?? 50) * 0.4 + (b.total > 0 ? b.done / b.total * 100 : 0) * 0.3 + b.avgProgress * 0.3;
      return scoreB - scoreA;
    }).map((m, i) => ({ ...m, rank: i + 1 }));
  }, [byPerson]);

  const topPerformers = useMemo(() => staffMetrics.filter((m) => m.done > 0).slice(0, 3), [staffMetrics]);

  //  Group by Team 
  const byTeam = useMemo(() => {
    const m = new Map<string, { team: any; wip: Task[]; done: Task[]; future: Task[] }>();
    const all = [...cats.wip, ...cats.done, ...cats.future];
    all.forEach((t: any) => {
      const tid = t.team_id || "_none";
      if (!m.has(tid)) {
        const tm = t.team || allTeams.find((te: any) => te.id === tid) || { id: tid, name: "Chưa phân nhóm", code: null };
        m.set(tid, { team: tm, wip: [], done: [], future: [] });
      }
      const c = categorize(t, dateFrom, dateTo);
      if (c) m.get(tid)![c].push(t);
    });
    return Array.from(m.values()).sort((a, b) => {
      if (a.team.id === "_none") return 1;
      if (b.team.id === "_none") return -1;
      return (b.wip.length + b.done.length + b.future.length) - (a.wip.length + a.done.length + a.future.length);
    });
  }, [cats, allTeams, dateFrom, dateTo]);

  const teamSummary = useMemo(() => {
    return byTeam.map((g) => {
      const allTasks = [...g.wip, ...g.done, ...g.future];
      const members = new Map<string, any>();
      allTasks.forEach((t: any) => {
        if (!t.assignee_id) return;
        members.set(t.assignee_id, t.assignee || users.find((u: any) => u.id === t.assignee_id) || { id: t.assignee_id, full_name: "—", role: "staff" });
      });
      const avgProgress = allTasks.length > 0 ? Math.round(allTasks.reduce((s, t) => s + (t.progress || 0), 0) / allTasks.length) : 0;
      const overdueCount = g.wip.filter((t) => t.status === "overdue").length;
      const risky = g.wip.filter((t) => {
        if (!t.deadline) return false;
        const dl = new Date(t.deadline);
        return Math.ceil((dl.getTime() - now.getTime()) / 86400000) <= 3 && (t.progress || 0) < 50;
      });
      return {
        team: g.team,
        wip: g.wip, done: g.done, future: g.future,
        taskCount: allTasks.length,
        memberCount: members.size,
        members: Array.from(members.values()),
        avgProgress,
        overdueCount,
        riskyCount: risky.length,
      };
    });
  }, [byTeam, users, now]);

  // Team member metrics (performance within team)
  const teamMemberMetrics = useMemo(() => {
    return teamSummary.map((ts) => {
      const memberStats = ts.members.map((u: any) => {
        const uWip = ts.wip.filter((t) => t.assignee_id === u.id);
        const uDone = ts.done.filter((t) => t.assignee_id === u.id);
        const uFuture = ts.future.filter((t) => t.assignee_id === u.id);
        const all = [...uWip, ...uDone, ...uFuture];
        const doneWithDl = uDone.filter((t) => t.deadline && t.completed_at);
        const onTimeCount = doneWithDl.filter((t) => new Date(t.completed_at!) <= new Date(t.deadline! + "T23:59:59")).length;
        const onTimeRate = doneWithDl.length > 0 ? Math.round((onTimeCount / doneWithDl.length) * 100) : null;
        const avgProgress = all.length > 0 ? Math.round(all.reduce((s, t) => s + (t.progress || 0), 0) / all.length) : 0;
        const overdueCount = uWip.filter((t) => t.status === "overdue").length;
        const lateCount = doneWithDl.length - onTimeCount;
        return { user: u, total: all.length, wip: uWip.length, done: uDone.length, future: uFuture.length, onTimeCount, lateCount, onTimeRate, avgProgress, overdueCount };
      }).sort((a, b) => {
        const scoreA = (a.onTimeRate ?? 50) * 0.4 + (a.total > 0 ? a.done / a.total * 100 : 0) * 0.3 + a.avgProgress * 0.3;
        const scoreB = (b.onTimeRate ?? 50) * 0.4 + (b.total > 0 ? b.done / b.total * 100 : 0) * 0.3 + b.avgProgress * 0.3;
        return scoreB - scoreA;
      }).map((m, i) => ({ ...m, rank: i + 1 }));
      return { teamId: ts.team.id, teamName: ts.team.name, memberStats };
    });
  }, [teamSummary]);

  // Team chart data
  const teamChartData = useMemo(() => {
    return byTeam.filter((g) => g.team.id !== "_none").slice(0, 12).map((g) => ({
      name: g.team.code || g.team.name?.split(" ").slice(-2).join(" ") || "N/A",
      "Đang TK": g.wip.length,
      "Hoàn thành": g.done.length,
      "Tương lai": g.future.length,
    }));
  }, [byTeam]);

  //  Overall Staff Metrics 
  const overallOnTimeRate = useMemo(() => {
    const doneWithDl = cats.done.filter((t) => t.deadline && t.completed_at);
    const onTime = doneWithDl.filter((t) => new Date(t.completed_at!) <= new Date(t.deadline! + "T23:59:59")).length;
    return doneWithDl.length > 0 ? Math.round((onTime / doneWithDl.length) * 100) : null;
  }, [cats.done]);

  const overallCycleTime = useMemo(() => {
    const d = cats.done.filter((t) => t.completed_at && t.start_date);
    const times = d.map((t) => Math.max(1, Math.ceil((new Date(t.completed_at!).getTime() - new Date(t.start_date!).getTime()) / 86400000)));
    return times.length > 0 ? Math.round(times.reduce((s, v) => s + v, 0) / times.length * 10) / 10 : null;
  }, [cats.done]);

  //  Trend Calculations 
  const trendData = useMemo(() => {
    const prevTotal = prevCats.wip.length + prevCats.done.length + prevCats.future.length;
    const prevDone = prevCats.done.length;
    const prevProgress = prevTotal > 0 ? Math.round([...prevCats.wip, ...prevCats.done, ...prevCats.future].reduce((s, t) => s + (t.progress || 0), 0) / prevTotal) : 0;
    const prevDoneWithDl = prevCats.done.filter((t) => t.deadline && t.completed_at);
    const prevOnTime = prevDoneWithDl.filter((t) => new Date(t.completed_at!) <= new Date(t.deadline! + "T23:59:59")).length;
    const prevOnTimeRate = prevDoneWithDl.length > 0 ? Math.round((prevOnTime / prevDoneWithDl.length) * 100) : null;
    const prevDoneWithDates = prevCats.done.filter((t) => t.completed_at && t.start_date);
    const prevTimes = prevDoneWithDates.map((t) => Math.max(1, Math.ceil((new Date(t.completed_at!).getTime() - new Date(t.start_date!).getTime()) / 86400000)));
    const prevCycleTime = prevTimes.length > 0 ? Math.round(prevTimes.reduce((s, v) => s + v, 0) / prevTimes.length * 10) / 10 : null;
    return {
      doneTrend: prevDone > 0 ? Math.round(((cats.done.length - prevDone) / prevDone) * 100) : 0,
      progressTrend: prevProgress > 0 ? overallProgress - prevProgress : 0,
      onTimeTrend: prevOnTimeRate !== null && overallOnTimeRate !== null ? overallOnTimeRate - prevOnTimeRate : 0,
      cycleTimeTrend: prevCycleTime !== null && overallCycleTime !== null ? Math.round((overallCycleTime - prevCycleTime) * 10) / 10 : 0,
      hasPrevData: prevTotal > 0,
    };
  }, [prevCats, cats, overallProgress, overallOnTimeRate, overallCycleTime]);

  // Export Excel
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (reportKind === "exec" && canViewExec) {
      const sumRows = projectSummary.map((x) => ({
        "Dự án": x.project?.code || "—",
        "Tên dự án": x.project?.name || "",
        "Số task": x.taskCount,
        "Đang triển khai": x.wip.length,
        "Đã hoàn thành": x.done.length,
        "Tương lai": x.future.length,
        "Tiến độ TB": x.avgProgress + "%",
        "Nhân sự tham gia": x.memberCount,
        "Ngân sách": x.project?.budget ?? 0,
        "Quỹ khoán": x.project?.allocation_fund ?? 0,
      }));
      const allocRows = projectSummary.flatMap((x) =>
        x.members.map((u: any) => ({
          "Dự án": x.project?.code || "—",
          "Nhân sự": u.full_name || "—",
          "Số task kỳ": [...x.wip, ...x.done, ...x.future].filter((t: any) => t.assignee_id === u.id).length,
        }))
      );
      const taskRows = [...cats.wip, ...cats.done, ...cats.future].map((t) => ({
        "Phân loại": categorize(t, dateFrom, dateTo) === "done" ? "Đã hoàn thành" : categorize(t, dateFrom, dateTo) === "future" ? "Tương lai" : "Đang triển khai",
        "Tên CV": t.title,
        "Dự án": t.project?.code || "",
        "Người TH": t.assignee?.full_name || "",
        "Trạng thái": STATUS_CONFIG[t.status]?.label || t.status,
        "Tiến độ": t.progress + "%",
        "Bắt đầu": t.start_date || "",
        "Deadline": t.deadline || "",
        "Hoàn thành": t.completed_at?.slice(0, 10) || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), "TongQuanDuAn");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allocRows), "NhanSuDuAn");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "CongViec");
      XLSX.writeFile(wb, `BC_BDH_${dateFrom}_${dateTo}.xlsx`);
      return;
    }

    const projRows = projectSummary.map((x) => ({
      "Dự án": x.project?.code || "—",
      "Tên dự án": x.project?.name || "",
      "Số task": x.taskCount,
      "Nhân sự tham gia": x.memberCount,
      "Đang triển khai": x.wip.length,
      "Đã hoàn thành": x.done.length,
      "Tương lai": x.future.length,
      "Tiến độ TB": x.avgProgress + "%",
    }));
    const taskRows = [...cats.wip, ...cats.done, ...cats.future].map((t) => {
      const isOnTime = t.completed_at && t.deadline ? new Date(t.completed_at) <= new Date(t.deadline + "T23:59:59") : null;
      return {
        "Dự án": t.project?.code || "",
        "Tên CV": t.title,
        "Người TH": t.assignee?.full_name || "",
        "Trạng thái": STATUS_CONFIG[t.status]?.label || t.status,
        "Tiến độ": t.progress + "%",
        "Bắt đầu": t.start_date || "",
        "Deadline": t.deadline || "",
        "Hoàn thành": t.completed_at?.slice(0, 10) || "",
        "Đúng hạn": isOnTime === null ? "" : isOnTime ? "✓" : "✗",
      };
    });
    const rankRows = staffMetrics.map((m) => ({
      "#": m.rank,
      "Nhân sự": m.user.full_name,
      "Tổng task": m.total,
      "Hoàn thành": m.done,
      "Đúng hạn (%)": m.onTimeRate !== null ? m.onTimeRate + "%" : "",
      "Trễ hạn": m.overdueCount + m.lateCount,
      "Tiến độ TB": m.avgProgress + "%",
      "Cycle Time (ngày)": m.avgCycleTime !== null ? m.avgCycleTime : "",
    }));
    // Team summary sheet
    const teamRows = teamSummary.filter((ts) => ts.team.id !== "_none").map((ts) => ({
      "Nhóm": ts.team.code ? `${ts.team.code} — ${ts.team.name}` : ts.team.name,
      "Leader": ts.team.leader?.full_name || "—",
      "Số task": ts.taskCount,
      "Đang TK": ts.wip.length,
      "Đã xong": ts.done.length,
      "Tương lai": ts.future.length,
      "Quá hạn": ts.overdueCount,
      "Tiến độ TB": ts.avgProgress + "%",
      "Nhân sự": ts.memberCount,
    }));
    // Team member detail sheet
    const teamMemberRows = teamMemberMetrics.flatMap((tm) => {
      if (tm.teamId === "_none") return [];
      return tm.memberStats.map((m) => ({
        "Nhóm": tm.teamName,
        "#": m.rank,
        "Nhân sự": m.user.full_name,
        "Tổng task": m.total,
        "Hoàn thành": m.done,
        "Đúng hạn (%)": m.onTimeRate !== null ? m.onTimeRate + "%" : "",
        "Quá hạn": m.overdueCount + m.lateCount,
        "Tiến độ TB": m.avgProgress + "%",
      }));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projRows), "DuAn");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "Tasks");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankRows), "XepHang");
    if (teamRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamRows), "TheoNhom");
    if (teamMemberRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamMemberRows), "NhanSuNhom");
    XLSX.writeFile(wb, `BC_PhongBan_${dateFrom}_${dateTo}.xlsx`);
  };

  // Export PDF (A3 landscape)
  const exportPDF = () => {
    window.print();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />
      <div className="print-report space-y-4 animate-fade-in">

        
        <div className="hidden print:block text-center border-b-2 border-gray-800 pb-3 mb-4">
          <h1 className="text-xl font-bold">{reportKind === "exec" ? "BÁO CÁO BAN ĐIỀU HÀNH" : "BÁO CÁO PHÒNG BAN"}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Từ {fmtFull(dateFrom)} đến {fmtFull(dateTo)} — Tổng cộng {total} công việc
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Ngày xuất: {new Date().toLocaleDateString("vi-VN")}</p>
        </div>

        
        <div className="print-hide bg-card border border-border rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold flex items-center gap-2"><Calendar size={18} className="text-primary" /> Báo cáo công việc</h1>
              <div className="flex items-center gap-1">
                <Button size="xs" variant={reportKind === "exec" ? "primary" : "default"} onClick={() => setReportKind("exec")} disabled={!canViewExec}>
                  Báo cáo Ban điều hành
                </Button>
                <Button size="xs" variant={reportKind === "staff" ? "primary" : "default"} onClick={() => setReportKind("staff")}>
                  Báo cáo phòng ban
                </Button>
              </div>
              <div className="flex gap-1">
                {[["Tuần này", setThisWeek], ["Tuần trước", setLastWeek], ["Tháng này", setThisMonth]].map(([l, fn]) => (
                  <button key={l as string} onClick={fn as any} className="px-2 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-primary/10 hover:text-primary transition-colors">{l as string}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground"><Landmark size={12} className="inline" /> TT</span>
              <select value={centerId} onChange={(e) => { setCenterId(e.target.value); }} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none min-w-[100px]">
                <option value="all">Tất cả</option>
                {centerOptions.map((c: any) => (<option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Phòng</span>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={!canChooseDept} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none min-w-[120px] disabled:opacity-70">
                {canChooseDept && <option value="all">Tất cả</option>}
                {!canChooseDept && deptOptionsFiltered.length === 0 && <option value="all">—</option>}
                {deptOptionsFiltered.map((d: any) => (<option key={d.id} value={d.id}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Nhóm</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none min-w-[100px]">
                <option value="all">Tất cả</option>
                {teamOptions.map((t: any) => (<option key={t.id} value={t.id}>{t.code ? `${t.code} — ${t.name}` : t.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">DA</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none min-w-[100px]">
                <option value="all">Tất cả</option>
                {projectOptions.map((p: any) => (<option key={p.id} value={p.id}>{p.code || p.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none w-[120px]" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 px-2 rounded-md border border-border bg-secondary text-xs focus:border-primary focus:outline-none w-[120px]" />
            </div>
            <span className="text-xs text-muted-foreground">{fmtFull(dateFrom)} — {fmtFull(dateTo)} · {total} CV</span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="xs" variant="default" onClick={exportPDF} className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
                <Printer size={14} /> PDF A3
              </Button>
              <Button size="xs" variant="primary" onClick={exportExcel}><Download size={14} /> Excel</Button>
            </div>
          </div>
        </div>

        
        {reportKind === "staff" && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-3 print:grid-cols-5">
              {/* Tiến độ — clickable */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setStaffDrill("progress")}>
                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-cyan-400" />
                <div className="flex items-center gap-1.5 mb-1"><BarChart3 size={13} className="text-blue-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Tiến độ</p></div>
                <div className="flex items-end gap-1.5">
                  <p className="text-2xl font-bold font-mono text-blue-500">{overallProgress}%</p>
                  {trendData.hasPrevData && <TrendIndicator value={trendData.progressTrend} suffix="%" />}
                </div>
                <ProgressBar value={overallProgress} showText={false} className="mt-1" />
              </div>
              {/* Hoàn thành — clickable */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors" onClick={() => setStaffDrill("completed")}>
                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-emerald-500" />
                <div className="flex items-center gap-1.5 mb-1"><CheckCircle2 size={13} className="text-emerald-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Hoàn thành</p></div>
                <div className="flex items-end gap-1.5">
                  <p className="text-2xl font-bold font-mono text-emerald-500">{cats.done.length}<span className="text-sm font-normal text-muted-foreground">/{total}</span></p>
                  {trendData.hasPrevData && <TrendIndicator value={trendData.doneTrend} suffix="%" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{total > 0 ? Math.round(cats.done.length / total * 100) : 0}% tổng CV</p>
              </div>
              {/* Đúng hạn — clickable */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer hover:border-cyan-400 transition-colors" onClick={() => setStaffDrill("ontime")}>
                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-cyan-500" />
                <div className="flex items-center gap-1.5 mb-1"><Clock size={13} className="text-cyan-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Đúng hạn</p></div>
                <div className="flex items-end gap-1.5">
                  <p className="text-2xl font-bold font-mono text-cyan-500">{overallOnTimeRate !== null ? `${overallOnTimeRate}%` : "—"}</p>
                  {trendData.hasPrevData && trendData.onTimeTrend !== 0 && <TrendIndicator value={trendData.onTimeTrend} suffix="%" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">On-time delivery rate</p>
              </div>
              {/* Cycle Time */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-violet-500" />
                <div className="flex items-center gap-1.5 mb-1"><Rocket size={13} className="text-violet-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Cycle Time</p></div>
                <div className="flex items-end gap-1.5">
                  <p className="text-2xl font-bold font-mono text-violet-500">{overallCycleTime !== null ? overallCycleTime : "—"} <span className="text-sm font-normal text-muted-foreground">ngày</span></p>
                  {trendData.hasPrevData && trendData.cycleTimeTrend !== 0 && <TrendIndicator value={-trendData.cycleTimeTrend} suffix="d" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">TB hoàn thành 1 task</p>
              </div>
              {/* Pie chart */}
              <div className="bg-card border border-border rounded-xl flex items-center justify-center print:h-[80px]">
                <ResponsiveContainer width="100%" height={90}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={20} outerRadius={36} paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* 🏆 Top Performers */}
            {topPerformers.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {topPerformers.map((p, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                  const borderColor = i === 0 ? "border-amber-400" : i === 1 ? "border-gray-300" : "border-amber-700/50";
                  const bgGlow = i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : "";
                  return (
                    <div key={p.user.id} className={`${bgGlow} bg-card border ${borderColor} rounded-xl px-4 py-2.5 flex items-center gap-3`}>
                      <span className="text-2xl">{medal}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: ROLE_CONFIG[p.user.role as keyof typeof ROLE_CONFIG]?.color ?? "#6366f1" }}>
                          {p.user.full_name?.split(" ").map((w: string) => w[0]).slice(-2).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold truncate">{p.user.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.done} xong · {p.onTimeRate !== null ? `${p.onTimeRate}% đúng hạn` : `${p.total} tasks`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {reportKind === "exec" && canViewExec && (
          <>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                <h2 className="text-xs font-bold uppercase tracking-wide text-foreground/80">Tóm tắt điều hành</h2>
                <span className="text-[10px] text-muted-foreground ml-auto">{fmtFull(dateFrom)} — {fmtFull(dateTo)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
                <div className={`bg-card border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${kpiDrill === "progress" ? "border-blue-500 ring-1 ring-blue-500/30" : "border-border"}`} onClick={() => toggleDrill("progress")}>
                  <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-cyan-400" />
                  <div className="flex items-center gap-1.5 mb-1"><BarChart3 size={13} className="text-blue-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Tiến độ</p></div>
                  <p className="text-2xl font-bold font-mono text-blue-500">{overallProgress}%</p>
                  <ProgressBar value={overallProgress} showText={false} className="mt-1" />
                </div>
                <div className={`bg-card border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${kpiDrill === "budget" ? "border-amber-500 ring-1 ring-amber-500/30" : "border-border"}`} onClick={() => toggleDrill("budget")}>
                  <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-amber-500" />
                  <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={13} className="text-amber-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Ngân sách</p></div>
                  <p className="text-lg font-bold font-mono">{money(financial.totalFund)}<span className="text-[11px] text-muted-foreground font-normal">/{money(financial.totalBudget)}</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-[4px] bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${budgetUsedPct}%`, background: budgetUsedPct > 80 ? "#ef4444" : budgetUsedPct > 60 ? "#f59e0b" : "#10b981" }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">({budgetUsedPct}%)</span>
                  </div>
                </div>
                <div className={`bg-card border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${kpiDrill === "people" ? "border-violet-500 ring-1 ring-violet-500/30" : "border-border"}`} onClick={() => toggleDrill("people")}>
                  <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-violet-500" />
                  <div className="flex items-center gap-1.5 mb-1"><Users size={13} className="text-violet-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Nhân lực</p></div>
                  <p className="text-2xl font-bold font-mono">{engagedPeople} <span className="text-sm text-muted-foreground font-normal">người</span></p>
                  <p className="text-[10px] text-muted-foreground">{financial.projectCount} dự án · {workloadHeatmap.filter((w) => w.status === "over").length > 0 ? `${workloadHeatmap.filter((w) => w.status === "over").length} quá tải` : "Cân bằng"}</p>
                </div>
                <div className={`bg-card border rounded-xl px-4 py-3 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${kpiDrill === "alerts" ? "border-red-500 ring-1 ring-red-500/30" : "border-border"}`} onClick={() => toggleDrill("alerts")}>
                  <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-red-500" />
                  <div className="flex items-center gap-1.5 mb-1"><AlertTriangle size={13} className="text-red-500" /><p className="text-[10px] text-muted-foreground font-semibold uppercase">Cảnh báo</p></div>
                  <p className="text-2xl font-bold font-mono text-red-500">{overdueTasks.length + riskyTasks.length} <span className="text-sm font-normal">vấn đề</span></p>
                  {(overdueTasks.length + riskyTasks.length) > 0 && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse mt-1" />}
                  {(overdueTasks.length + riskyTasks.length) === 0 && <p className="text-[10px] text-emerald-500 font-medium">✅ Ổn</p>}
                </div>
              </div>

              
              {kpiDrill && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold">
                      {kpiDrill === "progress" && "📊 Chi tiết tiến độ theo dự án"}
                      {kpiDrill === "budget" && "💰 Chi tiết ngân sách theo dự án"}
                      {kpiDrill === "people" && "👥 Chi tiết nhân sự tham gia"}
                      {kpiDrill === "alerts" && "⚠️ Chi tiết cảnh báo"}
                    </h3>
                    <button onClick={() => setKpiDrill(null)} className="text-muted-foreground hover:text-foreground text-sm p-1 rounded focus-ring" aria-label="Đóng">✕</button>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {kpiDrill === "progress" && (
                      <table className="w-full text-[11px]">
                        <thead><tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Dự án</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Tasks</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Xong</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground w-[120px]">Tiến độ</th>
                        </tr></thead>
                        <tbody>
                          {projectSummary.map((x) => (
                            <tr key={x.project?.id} className="border-b border-border/30 hover:bg-secondary/20">
                              <td className="px-3 py-1.5"><span className="font-mono font-bold text-primary">{x.project?.code}</span> <span className="text-muted-foreground">{x.project?.name}</span></td>
                              <td className="px-2 py-1.5 text-center font-mono">{x.taskCount}</td>
                              <td className="px-2 py-1.5 text-center font-mono text-emerald-600">{x.done.length}</td>
                              <td className="px-2 py-1.5"><ProgressBar value={x.avgProgress} showText /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {kpiDrill === "budget" && (
                      <table className="w-full text-[11px]">
                        <thead><tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Dự án</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground w-[90px]">Ngân sách</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground w-[90px]">Đã khoán</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[60px]">%</th>
                        </tr></thead>
                        <tbody>
                          {projectSummary.filter((x) => (x.project?.budget || 0) > 0).map((x) => {
                            const b = x.project?.budget || 0;
                            const f = x.project?.allocation_fund || 0;
                            const pct = b > 0 ? Math.round(f / b * 100) : 0;
                            return (
                              <tr key={x.project?.id} className="border-b border-border/30 hover:bg-secondary/20">
                                <td className="px-3 py-1.5"><span className="font-mono font-bold text-primary">{x.project?.code}</span></td>
                                <td className="px-2 py-1.5 text-right font-mono">{money(b)}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{money(f)}</td>
                                <td className="px-2 py-1.5 text-center"><span className={`font-mono font-bold ${pct > 100 ? "text-red-500" : pct > 80 ? "text-amber-500" : "text-emerald-600"}`}>{pct}%</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {kpiDrill === "people" && (
                      <table className="w-full text-[11px]">
                        <thead><tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Nhân sự</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Đang làm</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Xong</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Sắp tới</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground w-[50px]">Tổng</th>
                        </tr></thead>
                        <tbody>
                          {byPerson.map((p) => (
                            <tr key={p.user.id} className="border-b border-border/30 hover:bg-secondary/20">
                              <td className="px-3 py-1.5 font-medium">{p.user.full_name}</td>
                              <td className="px-2 py-1.5 text-center font-mono text-amber-600">{p.wip.length}</td>
                              <td className="px-2 py-1.5 text-center font-mono text-emerald-600">{p.done.length}</td>
                              <td className="px-2 py-1.5 text-center font-mono text-violet-600">{p.future.length}</td>
                              <td className="px-2 py-1.5 text-center font-mono font-bold">{p.wip.length + p.done.length + p.future.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {kpiDrill === "alerts" && (
                      <div className="p-3 space-y-2 text-[11px]">
                        {overdueTasks.length > 0 && <p className="text-[10px] font-bold uppercase text-red-500 mb-1">🔴 Quá hạn ({overdueTasks.length})</p>}
                        {overdueTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 py-1 border-b border-border/20 cursor-pointer hover:bg-secondary/30 rounded transition-colors" onClick={() => setSelectedTaskId(t.id)}>
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="flex-1 truncate">{t.title}</span>
                            <span className="text-muted-foreground font-mono">{t.project?.code || "—"}</span>
                            <span className="text-muted-foreground">{t.assignee?.full_name || "Chưa giao"}</span>
                            <span className="font-mono text-red-500">{t.progress}%</span>
                          </div>
                        ))}
                        {riskyTasks.length > 0 && <p className="text-[10px] font-bold uppercase text-amber-500 mt-2 mb-1">🟡 Sắp trễ deadline ({riskyTasks.length})</p>}
                        {riskyTasks.map((t) => {
                          const dl = Math.ceil((new Date(t.deadline!).getTime() - now.getTime()) / 86400000);
                          return (
                            <div key={t.id} className="flex items-center gap-2 py-1 border-b border-border/20 cursor-pointer hover:bg-secondary/30 rounded transition-colors" onClick={() => setSelectedTaskId(t.id)}>
                              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                              <span className="flex-1 truncate">{t.title}</span>
                              <span className="text-muted-foreground font-mono">{t.project?.code || "—"}</span>
                              <span className="text-amber-500 font-mono">{dl}d</span>
                              <span className="font-mono">{t.progress}%</span>
                            </div>
                          );
                        })}
                        {overdueTasks.length === 0 && riskyTasks.length === 0 && <p className="text-center text-muted-foreground py-4">✅ Không có cảnh báo nào</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Auto-generated executive summary */}
              <div className="bg-card border border-border rounded-xl px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Tóm tắt:</span>{" "}
                Trong kỳ {fmtFull(dateFrom)} – {fmtFull(dateTo)}: <span className="font-mono text-emerald-600 font-medium">{cats.done.length}</span> CV hoàn thành, <span className="font-mono text-amber-600 font-medium">{cats.wip.length}</span> đang triển khai, <span className="font-mono text-violet-600 font-medium">{cats.future.length}</span> sắp tới.
                Tiến độ tổng thể <span className={`font-mono font-medium ${overallProgress >= 70 ? "text-emerald-600" : overallProgress >= 40 ? "text-amber-600" : "text-red-600"}`}>{overallProgress}%</span>,
                ngân sách sử dụng <span className={`font-mono font-medium ${budgetUsedPct > 80 ? "text-red-600" : "text-foreground"}`}>{budgetUsedPct}%</span>.
                {overdueTasks.length > 0 && <> <span className="text-red-500 font-medium">⚠ {overdueTasks.length} CV quá hạn cần xử lý ngay.</span></>}
                {riskyTasks.length > 0 && <> <span className="text-amber-500 font-medium">{riskyTasks.length} CV có nguy cơ trễ deadline.</span></>}
                {overdueTasks.length === 0 && riskyTasks.length === 0 && <> <span className="text-emerald-500">Không có rủi ro đáng kể.</span></>}
              </div>
            </div>
          </>
        )}

        
        <div className="grid grid-cols-2 gap-3 print:gap-2">
          {/* Person stacked bar chart */}
          {reportKind === "staff" ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50">
                <h2 className="text-xs font-bold">📊 Phân bố CV theo nhân sự</h2>
              </div>
              <div className="p-2 h-[200px] print:h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={personChartData} barGap={2} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="Đang TK" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Hoàn thành" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Tương lai" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <h2 className="text-xs font-bold">Thành tựu & Tiến độ</h2>
                </div>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} /> Hoàn thành ({cats.done.length})</p>
                  {cats.done.length === 0 ? <p className="text-muted-foreground">Không có</p> : cats.done.slice(0, 4).map((t) => (
                    <p key={t.id} className="truncate" title={t.title}>• {t.project?.code && <span className="font-mono text-primary mr-1">{t.project.code}</span>}{t.title}</p>
                  ))}
                  {cats.done.length > 4 && <p className="text-muted-foreground text-[10px]">+{cats.done.length - 4} khác</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-amber-600 flex items-center gap-1"><Clock size={11} /> Đang triển khai ({cats.wip.length})</p>
                  {cats.wip.slice(0, 4).map((t) => (
                    <p key={t.id} className="truncate" title={t.title}>• {t.title} <span className="text-muted-foreground font-mono">{t.progress}%</span></p>
                  ))}
                  {cats.wip.length > 4 && <p className="text-muted-foreground text-[10px]">+{cats.wip.length - 4} khác</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-violet-600 flex items-center gap-1"><Rocket size={11} /> Sắp tới ({cats.future.length})</p>
                  {cats.future.length === 0 ? <p className="text-muted-foreground">Chưa có</p> : cats.future.slice(0, 4).map((t) => (
                    <p key={t.id} className="truncate" title={t.title}>• {t.title} <span className="text-muted-foreground">({fmt(t.start_date)})</span></p>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-1">🏆 Dự án nổi bật</p>
                  {projectSummary.slice(0, 3).map((x) => (
                    <div key={x.project?.id} className="flex items-center justify-between gap-1">
                      <span className="font-mono text-primary font-bold text-[10px]">{x.project?.code}</span>
                      <ProgressBar value={x.avgProgress} showText className="flex-1 max-w-[80px]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Project stacked bar chart */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50">
              <h2 className="text-xs font-bold">📊 Phân bố CV theo dự án</h2>
            </div>
            <div className="p-2 h-[200px] print:h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData} barGap={2} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="Đang TK" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Hoàn thành" stackId="a" fill="#10b981" />
                  <Bar dataKey="Tương lai" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        
        {reportKind === "staff" && workloadData.some((w) => w["Dự kiến"] > 0 || w["Thực tế"] > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50">
              <h2 className="text-xs font-bold">⏱️ Tải công việc (giờ dự kiến vs thực tế)</h2>
            </div>
            <div className="p-2 h-[220px] print:h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} barGap={2} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(value: number) => [`${value}h`]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Dự kiến" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Thực tế" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        
        {reportKind === "staff" && staffMetrics.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
              <h2 className="text-xs font-bold">🏅 Hiệu suất & Xếp hạng nhân sự</h2>
              <span className="text-[10px] text-muted-foreground">{staffMetrics.length} người · Kỳ {fmtFull(dateFrom)} — {fmtFull(dateTo)}</span>
            </div>
            <table className="w-full text-[12px] print:text-[10px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[35px]">#</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Nhân sự</th>
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[45px]">Tổng</th>
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-emerald-500 w-[45px]">Xong</th>
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-cyan-600 w-[70px]">Đúng hạn</th>
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-red-500 w-[45px]">Trễ</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Tiến độ</th>
                  <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-violet-500 w-[70px]">Cycle</th>
                </tr>
              </thead>
              <tbody>
                {staffMetrics.map((m) => {
                  const medal = m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : "";
                  return (
                    <tr key={m.user.id} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${m.rank <= 3 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                      <td className="px-2 py-1.5 text-center font-mono text-[11px]">{medal || m.rank}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                            style={{ background: ROLE_CONFIG[m.user.role as keyof typeof ROLE_CONFIG]?.color ?? "#6366f1" }}>
                            {m.user.full_name?.split(" ").map((w: string) => w[0]).slice(-2).join("")}
                          </div>
                          <span className="text-[11px] font-semibold truncate">{m.user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono">{m.total}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-emerald-600">{m.done}</td>
                      <td className="px-2 py-1.5 text-center">
                        {m.onTimeRate !== null ? (
                          <span className={`font-mono font-bold ${m.onTimeRate >= 80 ? "text-emerald-600" : m.onTimeRate >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.onTimeRate}%</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono" style={{ color: (m.overdueCount + m.lateCount) > 0 ? "#ef4444" : "#94a3b8" }}>{m.overdueCount + m.lateCount}</td>
                      <td className="px-2 py-1.5"><ProgressBar value={m.avgProgress} /></td>
                      <td className="px-2 py-1.5 text-center font-mono text-violet-600">{m.avgCycleTime !== null ? `${m.avgCycleTime}d` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        
        {reportKind === "staff" && workloadHeatmap.length > 0 && workloadHeatmap.some((w) => w.hours > 0) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50">
              <h2 className="text-xs font-bold">📊 Mức sử dụng năng lực (Utilization)</h2>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              {workloadHeatmap.map((w) => (
                <div key={w.name} className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium truncate">{w.name.split(" ").slice(-2).join(" ")}</span>
                    <span className={`text-[10px] font-mono font-bold ${w.status === "over" ? "text-red-500" : w.status === "normal" ? "text-emerald-600" : "text-blue-500"}`}>{w.pct}%</span>
                  </div>
                  <div className="h-[6px] bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(w.pct, 100)}%`, background: w.status === "over" ? "#ef4444" : w.status === "normal" ? "#10b981" : "#3b82f6" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Quá tải ({workloadHeatmap.filter((w) => w.status === "over").length})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Bình thường ({workloadHeatmap.filter((w) => w.status === "normal").length})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Dưới tải ({workloadHeatmap.filter((w) => w.status === "low").length})</span>
            </div>
          </div>
        )}

        
        {reportKind === "staff" && (riskyTasks.length > 0 || overdueTasks.length > 0 || staffMetrics.some((m) => m.wip > 8)) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
              <h2 className="text-xs font-bold flex items-center gap-1.5"><AlertTriangle size={13} className="text-red-500" /> Rủi ro & Cảnh báo</h2>
              <span className="text-[10px] text-muted-foreground">{overdueTasks.length + riskyTasks.length} vấn đề</span>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {overdueTasks.slice(0, 3).map((t) => (
                <AlertCard key={t.id} severity="critical" icon="🔴" title={t.title} description={`${t.project?.code || "—"} · ${t.assignee?.full_name || "Chưa giao"} · Quá hạn · ${t.progress}%`} onClick={() => setSelectedTaskId(t.id)} />
              ))}
              {riskyTasks.slice(0, 3).map((t) => {
                const daysLeft = Math.ceil((new Date(t.deadline!).getTime() - now.getTime()) / 86400000);
                return <AlertCard key={t.id} severity="warning" icon="🟡" title={t.title} description={`${t.project?.code || "—"} · Deadline còn ${daysLeft} ngày · ${t.progress}%`} onClick={() => setSelectedTaskId(t.id)} />;
              })}
              {staffMetrics.filter((m) => m.wip > 8).slice(0, 2).map((m) => (
                <AlertCard key={m.user.id} severity="warning" icon="👥" title={`${m.user.full_name} — Quá tải`} description={`Đang gánh ${m.wip} task đồng thời · ${m.overdueCount} quá hạn`} />
              ))}
            </div>
            <div className="px-3 py-2 border-t border-border/50 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Tóm tắt:</span>{" "}
              {overdueTasks.length > 0 && <span className="text-red-500 font-medium">⚠ {overdueTasks.length} CV quá hạn. </span>}
              {riskyTasks.length > 0 && <span className="text-amber-500 font-medium">{riskyTasks.length} CV sắp trễ deadline. </span>}
              {staffMetrics.filter((m) => m.wip > 8).length > 0 && <span className="text-violet-500 font-medium">{staffMetrics.filter((m) => m.wip > 8).length} nhân sự quá tải. </span>}
              {overdueTasks.length === 0 && riskyTasks.length === 0 && <span className="text-emerald-500">✅ Không có rủi ro đáng kể.</span>}
            </div>
          </div>
        )}

        
        {reportKind === "staff" && teamSummary.filter((ts) => ts.team.id !== "_none").length > 0 && (
          <>
            {/* Team Summary Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                <h2 className="text-xs font-bold flex items-center gap-1.5"><UsersRound size={13} className="text-indigo-500" /> Tổng hợp theo nhóm</h2>
                <span className="text-[10px] text-muted-foreground">{teamSummary.filter((ts) => ts.team.id !== "_none").length} nhóm · {fmtFull(dateFrom)} — {fmtFull(dateTo)}</span>
              </div>
              <table className="w-full text-[12px] print:text-[10px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Nhóm</th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Leader</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[45px]">Tasks</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-amber-500 w-[45px]">Đang</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-emerald-500 w-[45px]">Xong</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-violet-500 w-[45px]">Tới</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-red-500 w-[50px]">Quá hạn</th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Tiến độ</th>
                    <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[40px]">NS</th>
                  </tr>
                </thead>
                <tbody>
                  {teamSummary.filter((ts) => ts.team.id !== "_none").map((ts) => (
                    <tr key={ts.team.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          <span className="font-semibold text-[11px]">{ts.team.code && <span className="font-mono text-primary mr-1">{ts.team.code}</span>}{ts.team.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">{ts.team.leader?.full_name || "—"}</td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold">{ts.taskCount}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-amber-600">{ts.wip.length}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-emerald-600">{ts.done.length}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-violet-600">{ts.future.length}</td>
                      <td className="px-2 py-1.5 text-center font-mono" style={{ color: ts.overdueCount > 0 ? "#ef4444" : "#94a3b8" }}>{ts.overdueCount}</td>
                      <td className="px-2 py-1.5"><ProgressBar value={ts.avgProgress} /></td>
                      <td className="px-2 py-1.5 text-center font-mono text-[11px]">{ts.memberCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Team Stacked Bar Chart */}
            {teamChartData.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50">
                  <h2 className="text-xs font-bold">📊 Phân bố CV theo nhóm</h2>
                </div>
                <div className="p-2 h-[220px] print:h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamChartData} barGap={2} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} textAnchor="end" height={40} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="Đang TK" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Hoàn thành" stackId="a" fill="#10b981" />
                      <Bar dataKey="Tương lai" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Team Member Detail & Ranking */}
            {teamMemberMetrics.filter((tm) => tm.teamId !== "_none").map((tm) => (
              <div key={tm.teamId} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <h2 className="text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    🏅 {tm.teamName} — Hiệu suất thành viên
                  </h2>
                  <span className="text-[10px] text-muted-foreground">{tm.memberStats.length} người</span>
                </div>
                <table className="w-full text-[12px] print:text-[10px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[35px]">#</th>
                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Thành viên</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[45px]">Tổng</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-amber-500 w-[45px]">Đang</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-emerald-500 w-[45px]">Xong</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-cyan-600 w-[70px]">Đúng hạn</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-red-500 w-[45px]">Trễ</th>
                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tm.memberStats.map((m) => {
                      const medal = m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : "";
                      return (
                        <tr key={m.user.id} className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${m.rank <= 3 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                          <td className="px-2 py-1.5 text-center font-mono text-[11px]">{medal || m.rank}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                                style={{ background: ROLE_CONFIG[m.user.role as keyof typeof ROLE_CONFIG]?.color ?? "#6366f1" }}>
                                {m.user.full_name?.split(" ").map((w: string) => w[0]).slice(-2).join("")}
                              </div>
                              <span className="text-[11px] font-semibold truncate">{m.user.full_name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono">{m.total}</td>
                          <td className="px-2 py-1.5 text-center font-mono text-amber-600">{m.wip}</td>
                          <td className="px-2 py-1.5 text-center font-mono text-emerald-600">{m.done}</td>
                          <td className="px-2 py-1.5 text-center">
                            {m.onTimeRate !== null ? (
                              <span className={`font-mono font-bold ${m.onTimeRate >= 80 ? "text-emerald-600" : m.onTimeRate >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.onTimeRate}%</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-1.5 text-center font-mono" style={{ color: (m.overdueCount + m.lateCount) > 0 ? "#ef4444" : "#94a3b8" }}>{m.overdueCount + m.lateCount}</td>
                          <td className="px-2 py-1.5"><ProgressBar value={m.avgProgress} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Team Risk & Alerts */}
            {teamSummary.filter((ts) => ts.team.id !== "_none" && (ts.overdueCount > 0 || ts.riskyCount > 0)).length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <h2 className="text-xs font-bold flex items-center gap-1.5"><AlertTriangle size={13} className="text-red-500" /> Cảnh báo rủi ro theo nhóm</h2>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {teamSummary.filter((ts) => ts.team.id !== "_none" && (ts.overdueCount > 0 || ts.riskyCount > 0)).map((ts) => (
                    <AlertCard
                      key={ts.team.id}
                      severity={ts.overdueCount > 0 ? "critical" : "warning"}
                      icon={ts.overdueCount > 0 ? "🔴" : "🟡"}
                      title={`${ts.team.name} — ${ts.overdueCount > 0 ? `${ts.overdueCount} quá hạn` : `${ts.riskyCount} sắp trễ`}`}
                      description={`${ts.taskCount} tasks · ${ts.memberCount} người · Tiến độ ${ts.avgProgress}%`}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {reportKind === "exec" && canViewExec ? (
          <>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <h2 className="text-xs font-bold">Tổng quan dự án</h2>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{projectSummary.length} dự án</span>
                </div>
                <table className="w-full text-[12px] print:text-[10px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Dự án</th>
                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Tiến độ</th>
                      <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[80px]">Tasks</th>
                      <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[90px]">Ngân sách</th>
                      <th className="text-center px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[70px]">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectSummary.map((x) => {
                      const health = getProjectHealth(x);
                      const budgetPct = (x.project?.budget || 0) > 0 ? Math.round(((x.project?.allocation_fund || 0) / x.project.budget) * 100) : 0;
                      return (
                        <tr key={x.project?.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                          <td className="px-2 py-1.5 border-r border-border/20">
                            <span className="font-mono text-[11px] font-bold text-primary">{x.project?.code || "—"}</span>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={x.project?.name || ""}>{x.project?.name || ""}</div>
                          </td>
                          <td className="px-2 py-1.5 border-r border-border/20">
                            <ProgressBar value={x.avgProgress} />
                            <p className="text-[9px] text-muted-foreground mt-0.5">{x.done.length}/{x.taskCount} xong</p>
                          </td>
                          <td className="px-2 py-1.5 border-r border-border/20">
                            <span className="font-mono text-[11px] font-bold">{x.taskCount} tasks</span>
                            <p className="text-[9px] text-muted-foreground">{x.memberCount} people</p>
                          </td>
                          <td className="px-2 py-1.5 border-r border-border/20 text-right">
                            <span className="font-mono text-[11px]">{money(x.project?.budget)}</span>
                            <p className="text-[9px] text-muted-foreground">{budgetPct}% used</p>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: health.color }} />
                              <span className="text-[10px] font-medium" style={{ color: health.color }}>{health.label}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {projectSummary.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Right: Budget Utilization Chart */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50">
                  <h2 className="text-xs font-bold">💰 Sử dụng ngân sách</h2>
                </div>
                <div className="p-2 h-[260px]">
                  {budgetChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Chưa có dữ liệu ngân sách</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetChartData} barGap={4} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={35} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(value: number) => [`${value}M`]} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="Ngân sách" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Đã khoán" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>🔴 Vượt NS: {projectSummary.filter((x) => (x.project?.allocation_fund || 0) > (x.project?.budget || 0) && (x.project?.budget || 0) > 0).length}</span>
                  <span>🟡 Cảnh báo: {projectSummary.filter((x) => { const b = x.project?.budget || 0; const f = x.project?.allocation_fund || 0; return b > 0 && f / b > 0.8 && f <= b; }).length}</span>
                </div>
              </div>
            </div>

            
            {(riskyTasks.length > 0 || overdueTasks.length > 0 || (budgetUsedPct > 80 && overallProgress < 60)) && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
                    <h2 className="text-xs font-bold">Thách thức & Rủi ro</h2>
                    <span className="text-[10px] text-muted-foreground ml-auto">{overdueTasks.length + riskyTasks.length + (budgetUsedPct > 80 && overallProgress < 60 ? 1 : 0)} vấn đề</span>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {overdueTasks.slice(0, 3).map((t) => (
                    <AlertCard key={t.id} severity="critical" icon="🔴" title={t.title} description={`${t.project?.code || "—"} · ${t.assignee?.full_name || "Chưa giao"} · Quá hạn · ${t.progress}%`} onClick={() => setSelectedTaskId(t.id)} />
                  ))}
                  {riskyTasks.slice(0, 3).map((t) => {
                    const daysLeft = Math.ceil((new Date(t.deadline!).getTime() - now.getTime()) / 86400000);
                    return <AlertCard key={t.id} severity="warning" icon="🟡" title={t.title} description={`${t.project?.code || "—"} · Deadline còn ${daysLeft} ngày · ${t.progress}%`} onClick={() => setSelectedTaskId(t.id)} />;
                  })}
                  {budgetUsedPct > 80 && overallProgress < 60 && (
                    <AlertCard severity="warning" icon="💰" title="Ngân sách cao — tiến độ thấp" description={`Đã dùng ${budgetUsedPct}% ngân sách nhưng tiến độ chỉ ${overallProgress}%`} />
                  )}
                </div>
              </div>
            )}

            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">5</span>
                    <h2 className="text-xs font-bold">Phân tích tổng quan</h2>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-4">
                  <div className="w-[120px] h-[120px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value" stroke="none" label={({ name, percent }) => `${Math.round(percent * 100)}%`}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5 text-[11px]">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-mono font-bold ml-auto">{d.value}</span>
                      </div>
                    ))}
                    <div className="pt-1.5 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground">Tỷ lệ hoàn thành: <span className={`font-mono font-bold ${total > 0 && cats.done.length / total >= 0.5 ? "text-emerald-600" : "text-amber-600"}`}>{total > 0 ? Math.round(cats.done.length / total * 100) : 0}%</span></p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/50">
                  <h2 className="text-xs font-bold">💡 Nhận định tự động</h2>
                </div>
                <div className="p-3 space-y-2 text-[11px]">
                  {(() => {
                    const insights: { icon: string; text: string; color: string }[] = [];
                    const atRiskCount = projectSummary.filter((x) => getProjectHealth(x).label === "At risk" || getProjectHealth(x).label === "Warning").length;
                    if (atRiskCount > 0) insights.push({ icon: "⚠️", text: `${atRiskCount}/${projectSummary.length} dự án trong tình trạng cần lưu ý.`, color: "text-amber-600" });
                    if (budgetUsedPct > 80) insights.push({ icon: "💰", text: `Ngân sách đã sử dụng ${budgetUsedPct}% — cần rà soát chi phí.`, color: "text-red-600" });
                    else if (budgetUsedPct < 30 && financial.totalBudget > 0) insights.push({ icon: "✅", text: `Ngân sách sử dụng hợp lý (${budgetUsedPct}%) — còn dư địa.`, color: "text-emerald-600" });
                    const completionRate = total > 0 ? Math.round(cats.done.length / total * 100) : 0;
                    if (completionRate >= 70) insights.push({ icon: "🎯", text: `Tỷ lệ hoàn thành ${completionRate}% — hiệu suất tốt.`, color: "text-emerald-600" });
                    else if (completionRate < 30 && total > 5) insights.push({ icon: "📊", text: `Tỷ lệ hoàn thành thấp (${completionRate}%) — cần đẩy nhanh tiến độ.`, color: "text-red-600" });
                    const overloaded = workloadHeatmap.filter((w) => w.status === "over").length;
                    if (overloaded > 0) insights.push({ icon: "👥", text: `${overloaded} nhân sự quá tải — cần điều phối lại.`, color: "text-violet-600" });
                    if (insights.length === 0) insights.push({ icon: "✅", text: "Hoạt động ổn định, không có vấn đề nổi bật.", color: "text-emerald-600" });
                    return insights.map((ins, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0">{ins.icon}</span>
                        <p className={ins.color}>{ins.text}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">6</span>
                  <h2 className="text-xs font-bold">Kiến nghị & Bước tiếp theo</h2>
                </div>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {(() => {
                  const recs: { icon: string; text: string }[] = [];
                  if (overdueTasks.length > 0) recs.push({ icon: "🔴", text: `Ưu tiên giải quyết ${overdueTasks.length} công việc quá hạn (${overdueTasks.slice(0, 2).map((t) => t.project?.code || "—").join(", ")}).` });
                  if (riskyTasks.length > 0) recs.push({ icon: "🟡", text: `Theo dõi sát ${riskyTasks.length} CV sắp trễ deadline — kiểm tra tiến độ hàng ngày.` });
                  const overloaded = workloadHeatmap.filter((w) => w.status === "over");
                  if (overloaded.length > 0) recs.push({ icon: "👥", text: `Điều phối lại nhân sự: ${overloaded.map((w) => w.name.split(" ").pop()).join(", ")} đang quá tải.` });
                  if (budgetUsedPct > 80 && overallProgress < 60) recs.push({ icon: "💰", text: `Rà soát ngân sách — đã dùng ${budgetUsedPct}% nhưng tiến độ mới ${overallProgress}%.` });
                  if (upcomingMilestones.length > 0) recs.push({ icon: "📅", text: `Chuẩn bị cho ${upcomingMilestones.length} mốc thời gian quan trọng trong 14 ngày tới.` });
                  const lowProgressProjects = projectSummary.filter((x) => x.avgProgress < 30 && x.taskCount > 2);
                  if (lowProgressProjects.length > 0) recs.push({ icon: "📊", text: `Đẩy nhanh tiến độ dự án ${lowProgressProjects.map((x) => x.project?.code).join(", ")} (tiến độ < 30%).` });
                  if (recs.length === 0) recs.push({ icon: "✅", text: "Duy trì nhịp độ hiện tại. Không có vấn đề cần xử lý gấp." });
                  return recs.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="flex-shrink-0">{r.icon}</span>
                      <p>{r.text}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>


          </>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
                <h2 className="text-xs font-bold">📦 Nhân sự — Tổng hợp theo dự án</h2>
                <span className="text-[10px] text-muted-foreground">{projectSummary.length} dự án</span>
              </div>
              <table className="w-full text-[12px] print:text-[10px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[160px] print:w-[130px]">Dự án</th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[80px]">Task</th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[90px]">Nhân sự</th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSummary.map((x) => (
                    <tr key={x.project?.id} className="border-b border-border/30 hover:bg-secondary/20 align-top">
                      <td className="px-2 py-1.5 border-r border-border/20">
                        <span className="font-mono text-[11px] font-bold text-primary">{x.project?.code || "—"}</span>
                        <div className="text-[10px] text-muted-foreground truncate">{x.project?.name || ""}</div>
                      </td>
                      <td className="px-2 py-1 text-right border-r border-border/20 font-mono font-semibold">{x.taskCount}</td>
                      <td className="px-2 py-1 text-right border-r border-border/20 font-mono">{x.memberCount}</td>
                      <td className="px-2 py-1">
                        <ProgressBar value={x.avgProgress} showText />
                        <div className="text-[10px] text-muted-foreground mt-1">
                          <span className="text-amber-600 font-mono">{x.wip.length}</span> đang làm ·{" "}
                          <span className="text-emerald-600 font-mono">{x.done.length}</span> xong ·{" "}
                          <span className="text-violet-600 font-mono">{x.future.length}</span> sắp tới
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projectSummary.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>

            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/50">
                <h2 className="text-xs font-bold">📊 Phân bổ CV theo dự án & trạng thái</h2>
              </div>
              <div className="p-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectChartData} barGap={2} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={25} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Hoàn thành" stackId="a" fill="#10b981" />
                    <Bar dataKey="Đang TK" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Tương lai" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {reportKind === "staff" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
            <h2 className="text-xs font-bold">👤 Theo nhân sự — Chi tiết task</h2>
            <span className="text-[10px] text-muted-foreground">{byPerson.length} người</span>
          </div>
          <table className="w-full text-[12px] print:text-[10px]">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[140px] print:w-[100px]">Nhân sự</th>
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-amber-500">🕐 Đang triển khai</th>
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-emerald-500">✅ Đã hoàn thành</th>
                <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-violet-500">🚀 Tương lai</th>
              </tr>
            </thead>
            <tbody>
              {byPerson.map((p) => (
                <tr key={p.user.id} className="border-b border-border/30 hover:bg-secondary/20 align-top">
                  <td className="px-2 py-1.5 border-r border-border/20">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 print:w-4 print:h-4"
                        style={{ background: ROLE_CONFIG[p.user.role as keyof typeof ROLE_CONFIG]?.color ?? "#6366f1" }}>
                        {p.user.full_name?.split(" ").map((w: string) => w[0]).slice(-2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate print:text-[9px]">{p.user.full_name}</p>
                        <p className="text-[9px] text-muted-foreground">{p.wip.length + p.done.length + p.future.length} tasks</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1 border-r border-border/20">
                    {p.wip.length === 0 ? <span className="text-muted-foreground">—</span> : p.wip.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 py-[1px]">
                        <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="truncate flex-1" title={t.title}>{t.title}</span>
                        {t.project && <span className="text-[9px] text-primary font-mono flex-shrink-0">{t.project.code}</span>}
                        <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">{t.progress}%</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-2 py-1 border-r border-border/20">
                    {p.done.length === 0 ? <span className="text-muted-foreground">—</span> : p.done.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 py-[1px]">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="truncate flex-1 line-through text-muted-foreground" title={t.title}>{t.title}</span>
                        {t.project && <span className="text-[9px] text-primary font-mono flex-shrink-0">{t.project.code}</span>}
                      </div>
                    ))}
                  </td>
                  <td className="px-2 py-1">
                    {p.future.length === 0 ? <span className="text-muted-foreground">—</span> : p.future.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 py-[1px]">
                        <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                        <span className="truncate flex-1 text-muted-foreground" title={t.title}>{t.title}</span>
                        <span className="text-[9px] text-muted-foreground flex-shrink-0">{fmt(t.start_date)}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
              {byPerson.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
        )}

        
        {reportKind === "staff" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center justify-between">
              <h2 className="text-xs font-bold">🗂️ Tiến độ từng task (theo dự án)</h2>
              <span className="text-[10px] text-muted-foreground">{total} tasks</span>
            </div>
            <table className="w-full text-[12px] print:text-[10px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Dự án</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Task</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[60px]">Ưu tiên</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Người TH</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[95px]">Trạng thái</th>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[100px]">Tiến độ</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground w-[80px]">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[...cats.wip, ...cats.done, ...cats.future].map((t) => (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="px-2 py-1.5 border-r border-border/20 font-mono text-primary text-[11px] font-bold">{t.project?.code || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-border/20">
                      <span className="truncate block max-w-[200px]" title={t.title}>{t.title}</span>
                    </td>
                    <td className="px-2 py-1.5 border-r border-border/20"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-2 py-1.5 border-r border-border/20 text-[11px] truncate" title={t.assignee?.full_name || ""}>{t.assignee?.full_name || "—"}</td>
                    <td className="px-2 py-1.5 border-r border-border/20"><StatusBadge status={t.status} /></td>
                    <td className="px-2 py-1.5 border-r border-border/20"><ProgressBar value={t.progress} /></td>
                    <td className="px-2 py-1.5 text-right"><DeadlineCountdown deadline={t.deadline} /></td>
                  </tr>
                ))}
                {total === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Drill Panel */}
      {staffDrill && (() => {
        const panelMap: Record<string, { title: string; icon: any; color: string; tasks: Task[] }> = {
          progress: {
            title: "Tiến độ chi tiết theo dự án",
            icon: <BarChart3 size={18} className="text-blue-500" />,
            color: "blue",
            tasks: [...cats.wip, ...cats.done, ...cats.future].sort((a, b) => (a.progress || 0) - (b.progress || 0)),
          },
          completed: {
            title: "Công việc đã hoàn thành",
            icon: <CheckCircle2 size={18} className="text-emerald-500" />,
            color: "emerald",
            tasks: cats.done,
          },
          ontime: {
            title: "Công việc hoàn thành đúng hạn",
            icon: <Clock size={18} className="text-cyan-500" />,
            color: "cyan",
            tasks: cats.done.filter((t) => t.deadline && t.completed_at && new Date(t.completed_at) <= new Date(t.deadline + "T23:59:59")),
          },
        };
        const cfg = panelMap[staffDrill];
        if (!cfg) return null;
        return (
          <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setStaffDrill(null)}>
            <div className="w-[540px] bg-card border-l border-border h-full overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cfg.icon}
                  <h3 className="text-base font-bold">{cfg.title}</h3>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{cfg.tasks.length}</span>
                </div>
                <button onClick={() => setStaffDrill(null)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">✕</button>
              </div>
              {cfg.tasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Không có công việc</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {cfg.tasks.map((tk) => (
                    <div key={tk.id} className="px-5 py-3.5 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => { setStaffDrill(null); setSelectedTaskId(tk.id); }}>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={tk.status} />
                        <PriorityBadge priority={tk.priority} />
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{tk.progress}%</span>
                      </div>
                      <p className="text-sm font-semibold leading-snug">{tk.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        {tk.project && <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{(tk.project as any).code}</span>}
                        {tk.assignee && <span>{(tk.assignee as any).full_name}</span>}
                        {tk.deadline && <span className="ml-auto font-mono">{tk.deadline}</span>}
                        {tk.completed_at && <span className="font-mono text-emerald-500">{tk.completed_at.slice(0, 10)}</span>}
                      </div>
                      <ProgressBar value={tk.progress} className="mt-1.5" />
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
    </>
  );
}
