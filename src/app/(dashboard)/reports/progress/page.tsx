"use client";

import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useUsers } from "@/lib/hooks/use-data";
import { Section, StatCard, ProgressBar, UserAvatar, StatusBadge, HealthBadge } from "@/components/shared";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate } from "@/lib/utils/kpi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function ProgressReportPage() {
  const { data: tasks = [] } = useTasks({});
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();

  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status === "overdue").length;
  const avgProgress = tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;

  // Project progress
  const projectProgress = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.project_id === p.id);
    const pComplete = pTasks.filter((t) => t.status === "completed").length;
    const pOverdue = pTasks.filter((t) => t.status === "overdue").length;
    const progress = pTasks.length > 0 ? Math.round(pTasks.reduce((s, t) => s + t.progress, 0) / pTasks.length) : 0;
    const health = pOverdue / Math.max(pTasks.length, 1) > 0.2 ? "red" : pOverdue > 0 ? "yellow" : pTasks.length === 0 ? "gray" : "green";
    return { id: p.id, code: p.code, name: p.name, tasks: pTasks.length, completed: pComplete, overdue: pOverdue, progress, health, deadline: p.end_date };
  }).sort((a, b) => b.tasks - a.tasks);

  // User workload
  const userWorkload = users.map((u: any) => {
    const uTasks = tasks.filter((t) => t.assignee_id === u.id);
    const uActive = uTasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length;
    const uOverdue = uTasks.filter((t) => t.status === "overdue").length;
    const uCompleted = uTasks.filter((t) => t.status === "completed").length;
    return { id: u.id, name: u.full_name, role: u.role, total: uTasks.length, active: uActive, overdue: uOverdue, completed: uCompleted };
  }).filter((u) => u.total > 0).sort((a, b) => b.active - a.active);

  // Bar chart data for workload
  const workloadChart = userWorkload.slice(0, 10).map((u) => ({
    name: u.name.split(" ").pop(),
    active: u.active,
    completed: u.completed,
    overdue: u.overdue,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <button onClick={() => history.back()} className="text-sm text-muted-foreground hover:text-primary mb-2">← Báo cáo</button>
        <h1 className="text-xl font-bold">Báo cáo tiến độ</h1>
        <p className="text-base text-muted-foreground mt-0.5">Theo dõi tiến độ tổng hợp dự án và nhân sự</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng tasks" value={tasks.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Hoàn thành" value={completed} subtitle={`${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%`} accentColor="#10b981" />
        <StatCard label="Quá hạn" value={overdue} accentColor="#ef4444" />
        <StatCard label="Tiến độ TB" value={`${avgProgress}%`} accentColor="#3b82f6" />
      </div>

      {/* Workload Chart */}
      <Section title="Khối lượng công việc theo người">
        <div className="p-4 h-[320px]">
          {workloadChart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-base text-muted-foreground">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadChart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="active" name="Đang làm" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="completed" name="Hoàn thành" fill="#10b981" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="overdue" name="Quá hạn" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* Project Progress Table */}
      <Section title="Tiến độ theo dự án">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Dự án", "Tasks", "Hoàn thành", "Quá hạn", "Tiến độ", "Sức khỏe", "Deadline"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectProgress.map((p) => (
                <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-sm text-primary font-bold">{p.code}</span>
                    <span className="text-sm text-muted-foreground ml-2 truncate">{p.name}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm">{p.tasks}</td>
                  <td className="px-4 py-2.5 font-mono text-sm text-green-500">{p.completed}</td>
                  <td className="px-4 py-2.5 font-mono text-sm" style={{ color: p.overdue > 0 ? "#ef4444" : "#94a3b8" }}>{p.overdue}</td>
                  <td className="px-4 py-2.5"><ProgressBar value={p.progress} /></td>
                  <td className="px-4 py-2.5"><HealthBadge health={p.health as any} /></td>
                  <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">{formatDate(p.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* User Workload Table */}
      <Section title="Workload nhân sự">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Nhân viên", "Tổng", "Đang làm", "Hoàn thành", "Quá hạn"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userWorkload.map((u) => (
                <tr key={u.id} className="border-b border-border/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={u.name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                      <span className="text-sm font-semibold">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm">{u.total}</td>
                  <td className="px-4 py-2.5 font-mono text-sm text-blue-400">{u.active}</td>
                  <td className="px-4 py-2.5 font-mono text-sm text-green-500">{u.completed}</td>
                  <td className="px-4 py-2.5 font-mono text-sm" style={{ color: u.overdue > 0 ? "#ef4444" : "#94a3b8" }}>{u.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
