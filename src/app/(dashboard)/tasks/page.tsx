"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useTasks, useUpdateTask } from "@/lib/hooks/use-tasks";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useProjects } from "@/lib/hooks/use-projects";
import { useUsers } from "@/lib/hooks/use-users";
import { useTeams } from "@/lib/hooks/use-teams";
import { useUIStore, useAuthStore, type TaskSortKey } from "@/lib/stores";
import { StatusBadge, PriorityBadge, ProgressBar, UserAvatar, KPIRing, FilterChip, Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { Dialog, DialogContent } from "@/components/shared/dialog";
import { cn } from "@/lib/utils/cn";
import { ROLE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG, formatDate, formatRelativeDate } from "@/lib/utils/kpi";
import { TaskDetail } from "@/components/tasks/task-detail";
import { TaskForm } from "@/components/tasks/task-form";
import { ProposalForm } from "@/components/tasks/proposal-form";
import { ProposalList } from "@/components/tasks/proposal-list";
import { useProposalPendingCount } from "@/lib/hooks/use-proposals";
import { useI18n } from "@/lib/i18n";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";

const STATUS_ORDER: TaskStatus[] = ["pending", "in_progress", "review", "completed", "overdue"];

function sortTasks(tasks: Task[], key: TaskSortKey, dir: 'asc' | 'desc'): Task[] {
  const d = dir === 'asc' ? 1 : -1;
  const arr = [...tasks];
  arr.sort((a, b) => {
    switch (key) {
      case "title": return a.title.localeCompare(b.title) * d;
      case "status": return a.status.localeCompare(b.status) * d;
      case "priority": {
        const order = { low: 0, medium: 1, high: 2, urgent: 3 };
        return ((order[a.priority] ?? 0) - (order[b.priority] ?? 0)) * d;
      }
      case "assignee": return (a.assignee?.full_name || "").localeCompare(b.assignee?.full_name || "") * d;
      case "expect_score": return (a.expect_score - b.expect_score) * d;
      case "progress": return (a.progress - b.progress) * d;
      case "deadline": return (new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime()) * d;
      case "center": return ((a.department as any)?.center?.name || "").localeCompare((b.department as any)?.center?.name || "") * d;
      case "department": return (a.department?.name || "").localeCompare(b.department?.name || "") * d;
      case "team": return ((a.team as any)?.name || "").localeCompare((b.team as any)?.name || "") * d;
      default: return 0;
    }
  });
  return arr;
}

export default function TasksPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { taskView, setTaskView, taskFilters, setTaskFilters, taskSort, setTaskSort } = useUIStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showProposalList, setShowProposalList] = useState(false);
  const { data: proposalPendingCount = 0 } = useProposalPendingCount();
  const [searchInput, setSearchInput] = useState(taskFilters.search || "");
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: deptTeams = [] } = useTeams(user?.dept_id || undefined);
  const [filterCenter, setFilterCenter] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  const canAssign = user?.role !== "staff";
  const effectiveFilters = user?.role === "staff"
    ? { ...taskFilters, assignee_id: user.id }
    : taskFilters;
  const effectiveFiltersWithSearch = {
    ...effectiveFilters,
    search: debouncedSearch || undefined,
  };

  const { data: rawTasks = [], isLoading } = useTasks(effectiveFiltersWithSearch);

  // Client-side filter by center and department
  const tasks = useMemo(() => {
    let filtered = rawTasks;
    if (filterCenter !== "all") {
      filtered = filtered.filter((t: any) => t.department?.center?.id === filterCenter);
    }
    if (filterDept !== "all") {
      filtered = filtered.filter((t: any) => t.department?.id === filterDept);
    }
    return filtered;
  }, [rawTasks, filterCenter, filterDept]);

  // Extract unique centers and departments from tasks for filter dropdowns
  const centerOptions = useMemo(() => {
    const map = new Map<string, string>();
    rawTasks.forEach((t: any) => {
      if (t.department?.center?.id && t.department.center.name) {
        map.set(t.department.center.id, t.department.center.name);
      }
    });
    return Array.from(map, ([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rawTasks]);

  const deptOptions = useMemo(() => {
    const map = new Map<string, string>();
    let source = rawTasks;
    if (filterCenter !== "all") {
      source = rawTasks.filter((t: any) => t.department?.center?.id === filterCenter);
    }
    source.forEach((t: any) => {
      if (t.department?.id && t.department.name) {
        map.set(t.department.id, t.department.code ? `${t.department.code} — ${t.department.name}` : t.department.name);
      }
    });
    return Array.from(map, ([id, label]) => ({ value: id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rawTasks, filterCenter]);

  const handleSearch = (val: string) => {
    setSearchInput(val);
  };

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  const sortOptions: { value: TaskSortKey; label: string }[] = [
    { value: "deadline", label: t.tasks.deadline },
    { value: "priority", label: t.tasks.priorityCol },
    { value: "center", label: t.tasks.center },
    { value: "department", label: t.tasks.department },
    { value: "team", label: t.tasks.team },
    { value: "assignee", label: t.tasks.assignee },
    { value: "progress", label: t.tasks.progress },
    { value: "expect_score", label: t.tasks.kpiE },
    { value: "title", label: t.tasks.title },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">{t.pages.taskManagement}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.total} {t.nav.tasks} · {stats.inProgress} {t.status.in_progress} · {stats.overdue} {t.status.overdue}
            </p>
          </div>
          {/* View Switcher */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {([
              ["grid", t.tasks.viewGrid],
              ["kanban", t.tasks.viewKanban],
              ["gantt", t.tasks.viewTimeline],
              ["calendar", t.tasks.viewCalendar],
              ["workload", t.tasks.viewWorkload],
            ] as [string, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setTaskView(v as any)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  taskView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAssign && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              {t.tasks.newTask}
            </Button>
          )}
          <Button onClick={() => setShowProposalForm(true)}>
            📝 {t.tasks.propose}
          </Button>
          <button
            onClick={() => setShowProposalList(true)}
            className="relative px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            📋 {t.tasks.proposals}
            {proposalPendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {proposalPendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status */}
        <div className="flex items-center gap-1">
          <FilterChip active={taskFilters.status === "all" || !taskFilters.status} onClick={() => setTaskFilters({ status: "all" })}>
            {t.status.all}
          </FilterChip>
          {STATUS_ORDER.map((s) => (
            <FilterChip key={s} active={taskFilters.status === s} onClick={() => setTaskFilters({ status: s })}>
              {STATUS_CONFIG[s].icon} {t.status[s]}
            </FilterChip>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Priority */}
        <SearchSelect
          value={taskFilters.priority || "all"}
          onChange={(val) => setTaskFilters({ priority: val as TaskPriority | "all" })}
          options={[
            { value: "all", label: `${t.tasks.priorityCol}: ${t.common.all}` },
            ...(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => ({
              value: p,
              label: `${PRIORITY_CONFIG[p].icon} ${t.priority[p]}`,
            })),
          ]}
          placeholder={`${t.tasks.priorityCol}: ${t.common.all}`}
          className="h-8 w-36 bg-card text-xs"
        />

        {/* Center */}
        {centerOptions.length > 0 && (
          <SearchSelect
            value={filterCenter}
            onChange={(val) => { setFilterCenter(val); setFilterDept("all"); }}
            options={[
              { value: "all", label: t.tasks.centerAll },
              ...centerOptions,
            ]}
            placeholder={t.tasks.centerAll}
            className="h-8 w-40 bg-card text-xs"
          />
        )}

        {/* Department */}
        {deptOptions.length > 0 && (
          <SearchSelect
            value={filterDept}
            onChange={(val) => setFilterDept(val)}
            options={[
              { value: "all", label: t.tasks.deptAll },
              ...deptOptions,
            ]}
            placeholder={t.tasks.deptAll}
            className="h-8 w-40 bg-card text-xs"
          />
        )}

        {/* Team */}
        {deptTeams.length > 0 && (
          <SearchSelect
            value={taskFilters.team_id || "all"}
            onChange={(val) => setTaskFilters({ team_id: val })}
            options={[
              { value: "all", label: t.tasks.teamAll },
              ...deptTeams.map((t: any) => ({ value: t.id, label: t.name })),
            ]}
            placeholder={t.tasks.teamAll}
            className="h-8 w-36 bg-card text-xs"
          />
        )}

        {/* Project */}
        <SearchSelect
          value={taskFilters.project_id || "all"}
          onChange={(val) => setTaskFilters({ project_id: val })}
          options={[
            { value: "all", label: t.tasks.projectAll },
            ...projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
          ]}
          placeholder={t.tasks.projectAll}
          className="h-8 w-40 bg-card text-xs"
        />

        {/* Search */}
        <div className="relative ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t.tasks.searchPlaceholder}
            className="w-40 h-8 pl-7 pr-2 rounded-lg border border-border bg-card text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>

        {/* Sort (for Kanban & Timeline) */}
        {(taskView === "kanban" || taskView === "gantt") && (
          <div className="flex items-center gap-1.5">
            <SearchSelect
              value={taskSort.key}
              onChange={(val) => setTaskSort(val as TaskSortKey)}
              options={sortOptions}
              placeholder={`${t.tasks.sortBy}...`}
              className="h-8 w-32 bg-card text-xs"
            />
            <button
              onClick={() => setTaskSort(taskSort.key, taskSort.dir === "asc" ? "desc" : "asc")}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-card text-xs hover:bg-secondary transition-colors"
              title={taskSort.dir === "asc" ? t.common.ascending : t.common.descending}
            >
              {taskSort.dir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        )}

      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon="📋" title={t.tasks.noTasks} subtitle={t.tasks.noTasksSub} />
      ) : taskView === "grid" ? (
        <TaskGrid tasks={tasks} onSelect={setSelectedTaskId} />
      ) : taskView === "kanban" ? (
        <TaskKanban tasks={tasks} onSelect={setSelectedTaskId} />
      ) : taskView === "calendar" ? (
        <TaskCalendar tasks={tasks} onSelect={setSelectedTaskId} />
      ) : taskView === "workload" ? (
        <TaskWorkload tasks={tasks} onSelect={setSelectedTaskId} />
      ) : (
        <TaskTimeline tasks={tasks} onSelect={setSelectedTaskId} />
      )}

      {/* Modals */}
      {selectedTaskId && <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      {showForm && <TaskForm onClose={() => setShowForm(false)} />}
      {showProposalForm && <ProposalForm onClose={() => setShowProposalForm(false)} />}
      {showProposalList && <ProposalList onClose={() => setShowProposalList(false)} />}
    </div>
  );
}

type SortKey = TaskSortKey;
type SortDir = "asc" | "desc";
const ITEMS_PER_PAGE = 20;

function TaskGrid({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const headers: { key: SortKey; label: string; defaultWidth: number }[] = [
    { key: "title", label: t.tasks.titleCol, defaultWidth: 340 },
    { key: "center", label: t.tasks.center, defaultWidth: 130 },
    { key: "department", label: t.tasks.department, defaultWidth: 130 },
    { key: "team", label: t.tasks.team, defaultWidth: 120 },
    { key: "status", label: t.tasks.statusCol, defaultWidth: 120 },
    { key: "priority", label: t.tasks.priorityCol, defaultWidth: 100 },
    { key: "assignee", label: t.tasks.assignee, defaultWidth: 160 },
    { key: "expect_score", label: t.tasks.kpiE, defaultWidth: 90 },
    { key: "progress", label: t.tasks.progress, defaultWidth: 130 },
    { key: "deadline", label: t.tasks.deadline, defaultWidth: 120 },
  ];

  const [colWidths, setColWidths] = useState<number[]>(() => headers.map((h) => h.defaultWidth));
  const resizingRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(60, resizingRef.current.startW + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingRef.current!.colIdx] = newW;
        return next;
      });
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [colWidths]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const sorted = useMemo(() => sortTasks(tasks, sortKey, sortDir), [tasks, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paged = sorted.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table style={{ tableLayout: "fixed", width: colWidths.reduce((s, w) => s + w, 0) }}>
          <thead>
            <tr className="border-b border-border bg-secondary/50 sticky top-0 z-10">
              {headers.map((h, idx) => (
                <th
                  key={h.key}
                  style={{ width: colWidths[idx], minWidth: 60, position: "relative" }}
                  onClick={() => toggleSort(h.key)}
                  className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {sortKey === h.key && (
                      <span className="text-primary text-[11px]">{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => onResizeStart(e, idx)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
                    style={{ zIndex: 20 }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((task) => (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="border-b border-border/40 hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {task.project && (
                      <span className="text-[11px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {task.project.code}
                      </span>
                    )}
                    <span className="text-base font-medium truncate block w-full">{task.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm truncate block">{(task.department as any)?.center?.name || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm truncate block">{task.department?.name || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm truncate block">
                    {task.team && typeof task.team === 'object' && !Array.isArray(task.team) ? task.team.name || "—" : "—"}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className="px-4 py-3">
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="xs" />
                      <span className="text-sm truncate max-w-[100px]">{task.assignee.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <KPIRing score={task.expect_score} size={28} strokeWidth={2.5} />
                    <span className="font-mono text-sm font-medium">{Math.round(task.expect_score)}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><ProgressBar value={task.progress} /></td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-mono ${task.status === "overdue" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {formatDate(task.deadline)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/30">
          <span className="text-xs text-muted-foreground">
            {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, sorted.length)} / {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2.5 py-1 text-xs rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.tasks.prevPage}
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : (page <= 3 ? i : page >= totalPages - 4 ? totalPages - 7 + i : page - 3 + i);
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-8 text-xs rounded transition-colors ${page === p ? "bg-primary text-primary-foreground font-bold" : "hover:bg-secondary text-muted-foreground"}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2.5 py-1 text-xs rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.tasks.nextPage}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskKanban({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { taskSort } = useUIStore();
  const updateTask = useUpdateTask();
  const [pendingDrag, setPendingDrag] = useState<{ taskId: string; taskTitle: string; newStatus: TaskStatus } | null>(null);
  const columns: { status: TaskStatus; label: string; color: string }[] = [
    { status: "pending", label: t.status.pending, color: "#94a3b8" },
    { status: "in_progress", label: t.status.in_progress, color: "#3b82f6" },
    { status: "review", label: t.status.review, color: "#f59e0b" },
    { status: "completed", label: t.status.completed, color: "#10b981" },
  ];

  const statusLabel = (s: TaskStatus) => columns.find((c) => c.status === s)?.label || s;

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as TaskStatus;
    const taskId = result.draggableId;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setPendingDrag({ taskId, taskTitle: task.title, newStatus });
  };

  const confirmDrag = () => {
    if (pendingDrag) {
      updateTask.mutate({ id: pendingDrag.taskId, status: pendingDrag.newStatus });
      setPendingDrag(null);
    }
  };

  return (
    <>
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = sortTasks(tasks.filter((t) => t.status === col.status), taskSort.key, taskSort.dir);
          return (
            <div key={col.status} className="min-w-[280px] w-[280px] flex-shrink-0">
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Droppable Column */}
              <Droppable droppableId={col.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2.5 min-h-[100px] rounded-lg p-1 transition-colors",
                      snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onSelect(task.id)}
                            className={cn(
                              "bg-card border border-border rounded-xl p-3.5 cursor-grab hover:border-primary/40 hover:shadow-sm transition-all",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/30 rotate-[1deg]"
                            )}
                          >
                            {/* Project & Team tags */}
                            <div className="flex items-center gap-1 flex-wrap mb-1.5">
                              {task.project && (
                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded inline-block">
                                  {task.project.code}
                                </span>
                              )}
                              {task.team && typeof task.team === 'object' && !Array.isArray(task.team) && task.team.name && (
                                <span className="text-[10px] font-mono text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded inline-block">
                                  {task.team.name}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>

                            {/* Meta */}
                            <div className="flex items-center gap-2 mt-2.5">
                              <PriorityBadge priority={task.priority} />
                              <span className="text-[11px] text-muted-foreground font-mono">W:{task.kpi_weight}</span>
                              <div className="ml-auto">
                                <KPIRing score={task.expect_score} size={26} strokeWidth={2} />
                              </div>
                            </div>

                            {/* Progress + Assignee */}
                            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/50">
                              <ProgressBar value={task.progress} className="flex-1 mr-2" />
                              {task.assignee ? (
                                <UserAvatar
                                  name={task.assignee.full_name}
                                  color={ROLE_CONFIG[task.assignee.role]?.color}
                                  size="xs"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/30" />
                              )}
                            </div>

                            {/* Deadline */}
                            {task.deadline && (
                              <p className={`text-[11px] mt-1.5 ${task.status === "overdue" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                {formatDate(task.deadline)}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                        <p className="text-sm text-muted-foreground">{t.tasks.empty}</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>

      {/* Kanban Drag Confirm Dialog */}
      <Dialog open={!!pendingDrag} onOpenChange={(open) => !open && setPendingDrag(null)}>
        <DialogContent title={t.tasks.changeStatus} size="sm">
          <p className="text-base text-muted-foreground">
            {t.tasks.confirmMove} <strong className="text-foreground">{pendingDrag?.taskTitle}</strong> {t.tasks.toStatus}{" "}
            <strong className="text-primary">{pendingDrag ? statusLabel(pendingDrag.newStatus) : ""}</strong>?
          </p>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setPendingDrag(null)}
              className="px-4 py-2 text-base rounded-lg border border-border hover:bg-secondary transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={confirmDrag}
              disabled={updateTask.isPending}
              className="px-4 py-2 text-base rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
            >
              {updateTask.isPending ? t.tasks.updating : t.common.confirm}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskTimeline({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { taskSort } = useUIStore();
  const today = new Date();
  const sorted = sortTasks(
    tasks.filter((t) => t.start_date || t.deadline),
    taskSort.key, taskSort.dir
  );

  // Calculate timeline range
  const allDates = sorted.flatMap((t) => [t.start_date, t.deadline, t.created_at].filter(Boolean)).map((d) => new Date(d!));
  if (allDates.length === 0) return <EmptyState icon="📅" title={t.tasks.noTimelineData} subtitle={t.tasks.noTimelineDataSub} />;

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())) - 7 * 86400000);
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())) + 7 * 86400000);
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000);

  const getPos = (date: string | null) => {
    if (!date) return 0;
    return ((new Date(date).getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100;
  };

  // Generate month markers
  const months: { label: string; pos: number }[] = [];
  const cur = new Date(minDate);
  cur.setDate(1);
  while (cur <= maxDate) {
    const pos = getPos(cur.toISOString());
    if (pos >= 0 && pos <= 100) {
      months.push({ label: `T${cur.getMonth() + 1}/${cur.getFullYear()}`, pos });
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  const todayPos = getPos(today.toISOString());
  const statusColors: Record<string, string> = {
    pending: "#94a3b8", in_progress: "#f59e0b", review: "#f59e0b", completed: "#10b981", overdue: "#ef4444",
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Month Headers */}
      <div className="flex border-b border-border bg-secondary/50">
        {/* Label header */}
        <div className="w-[200px] flex-shrink-0 px-3 py-2.5 border-r border-border/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.tasks.taskLabel}</span>
        </div>
        {/* Timeline header */}
        <div className="flex-1 relative h-10">
          {months.map((m, i) => (
            <div key={i} className="absolute top-0 h-full border-l border-border/50 px-1.5 flex items-center" style={{ left: `${m.pos}%` }}>
              <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">{m.label}</span>
            </div>
          ))}
          {todayPos >= 0 && todayPos <= 100 && (
            <div className="absolute top-0 h-full w-0.5 bg-destructive z-10" style={{ left: `${todayPos}%` }}>
              <span className="absolute -top-0 left-1 text-[8px] text-destructive font-bold">{t.tasks.today}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task Bars */}
      <div className="divide-y divide-border/30">
        {sorted.map((task) => {
          const start = task.start_date || task.created_at;
          const end = task.deadline || task.start_date || task.created_at;
          const left = getPos(start);
          const right = getPos(end);
          const width = Math.max(right - left, 1);
          const color = statusColors[task.status] || "#6366f1";

          return (
            <div key={task.id} className="flex items-center hover:bg-secondary/20 cursor-pointer" onClick={() => onSelect(task.id)}>
              {/* Label column */}
              <div className="w-[200px] flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-r border-border/30 overflow-hidden">
                {task.assignee && <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="xs" />}
                <span className="text-xs font-medium truncate">{task.title}</span>
              </div>
              {/* Bar column */}
              <div className="flex-1 relative h-10 min-w-0">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-5 rounded opacity-80 hover:opacity-100 transition-opacity"
                  style={{ left: `${left}%`, width: `${Math.max(width, 2)}%`, background: color }}
                  title={`${task.title}\n${formatDate(start)} → ${formatDate(end)}\n${t.tasks.progress}: ${task.progress}%`}
                >
                  {width > 5 && (
                    <div className="h-full rounded bg-white/20" style={{ width: `${task.progress}%` }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tasks.filter((t) => !t.start_date && !t.deadline).length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-secondary/30">
          <p className="text-[11px] text-muted-foreground">
            {tasks.filter((t) => !t.start_date && !t.deadline).length} {t.tasks.tasksHiddenTimeline}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───── Calendar View ──────────────────────────────────────────── */
function TaskCalendar({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Map tasks to their deadline day
  const tasksByDay = new Map<number, Task[]>();
  for (const task of tasks) {
    if (!task.deadline) continue;
    const d = new Date(task.deadline);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay.has(day)) tasksByDay.set(day, []);
      tasksByDay.get(day)!.push(task);
    }
  }

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const statusColors: Record<string, string> = {
    pending: "#94a3b8", in_progress: "#f59e0b", review: "#f59e0b", completed: "#10b981", overdue: "#ef4444",
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={prevMonth} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">←</button>
        <span className="text-sm font-semibold">T{month + 1}/{year}</span>
        <button onClick={nextMonth} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground">→</button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {weekDays.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`e-${i}`} className="min-h-[80px] border-r border-b border-border/30" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const dayTasks = tasksByDay.get(day) || [];

          return (
            <div key={day} className={cn("min-h-[80px] border-r border-b border-border/30 p-1", isToday && "bg-primary/5")}>
              <span className={cn("text-[11px] font-mono", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelect(task.id)}
                    className="w-full text-left px-1 py-0.5 rounded text-[10px] truncate hover:opacity-80 transition-opacity"
                    style={{ background: `${statusColors[task.status] || "#6366f1"}20`, color: statusColors[task.status] || "#6366f1" }}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] text-muted-foreground px-1">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Workload View ──────────────────────────────────────────── */
function TaskWorkload({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();

  // Group tasks by assignee
  const userMap = new Map<string, { name: string; avatar: string | null; role: string; tasks: Task[] }>();
  for (const task of tasks) {
    if (!task.assignee_id || !task.assignee) continue;
    if (!userMap.has(task.assignee_id)) {
      userMap.set(task.assignee_id, {
        name: task.assignee.full_name,
        avatar: task.assignee.avatar_url ?? null,
        role: task.assignee.role,
        tasks: [],
      });
    }
    userMap.get(task.assignee_id)!.tasks.push(task);
  }

  const users = Array.from(userMap.entries())
    .map(([id, u]) => ({ id, ...u, count: u.tasks.length }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...users.map((u) => u.count), 1);

  const statusColors: Record<string, string> = {
    pending: "#94a3b8", in_progress: "#f59e0b", review: "#f59e0b", completed: "#10b981", overdue: "#ef4444",
  };

  if (users.length === 0) return <EmptyState title={t.tasks.noTasks} subtitle={t.tasks.noTasksSub} />;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border/30">
        {users.map((u) => {
          const completed = u.tasks.filter((t) => t.status === "completed").length;
          const inProgress = u.tasks.filter((t) => ["in_progress", "review"].includes(t.status)).length;
          const overdue = u.tasks.filter((t) => t.status === "overdue").length;

          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
              {/* User info */}
              <div className="w-[160px] flex-shrink-0 flex items-center gap-2">
                <UserAvatar name={u.name} src={u.avatar} color={(ROLE_CONFIG as any)[u.role]?.color} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">{u.count} {t.nav.tasks}</p>
                </div>
              </div>

              {/* Stacked bar */}
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-5 bg-secondary rounded overflow-hidden flex">
                  {completed > 0 && (
                    <div className="h-full" style={{ width: `${(completed / maxCount) * 100}%`, background: "#10b981" }} title={`${t.status.completed}: ${completed}`} />
                  )}
                  {inProgress > 0 && (
                    <div className="h-full" style={{ width: `${(inProgress / maxCount) * 100}%`, background: "#f59e0b" }} title={`${t.status.in_progress}: ${inProgress}`} />
                  )}
                  {overdue > 0 && (
                    <div className="h-full" style={{ width: `${(overdue / maxCount) * 100}%`, background: "#ef4444" }} title={`${t.status.overdue}: ${overdue}`} />
                  )}
                  {(u.count - completed - inProgress - overdue) > 0 && (
                    <div className="h-full" style={{ width: `${((u.count - completed - inProgress - overdue) / maxCount) * 100}%`, background: "#94a3b8" }} title={`${t.status.pending}: ${u.count - completed - inProgress - overdue}`} />
                  )}
                </div>
                <span className="text-xs font-mono text-muted-foreground w-6 text-right">{u.count}</span>
              </div>

              {/* Task chips */}
              <div className="w-[200px] flex-shrink-0 flex flex-wrap gap-1">
                {u.tasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelect(task.id)}
                    className="px-1.5 py-0.5 rounded text-[10px] truncate max-w-[90px] hover:opacity-80 transition-opacity"
                    style={{ background: `${statusColors[task.status] || "#6366f1"}20`, color: statusColors[task.status] || "#6366f1" }}
                  >
                    {task.title}
                  </button>
                ))}
                {u.tasks.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{u.tasks.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
