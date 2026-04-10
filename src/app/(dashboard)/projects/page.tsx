"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjects, useDeleteProject, useArchiveProject } from "@/features/projects";
import { useContracts } from "@/features/contracts";
import { useTasks } from "@/features/tasks";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useAuthStore } from "@/lib/stores";
import { canCreateProject } from "@/lib/utils/permissions";
import { Dialog, DialogContent } from "@/components/shared/dialog";
import {
  Button, FilterChip, EmptyState, ProgressBar, HealthBadge, UserAvatar, StatCard, KPIRing,
} from "@/components/shared";
import { Building2 } from "lucide-react";
import { ROLE_CONFIG, formatDate, formatVND } from "@/lib/utils/kpi";
import { useI18n } from "@/lib/i18n";
import type { Project, ProjectStatus, UserRole } from "@/lib/types";

type ViewMode = "grid" | "list";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: "#94a3b8",
  active: "#3b82f6",
  paused: "#f59e0b",
  completed: "#10b981",
  archived: "#6b7280",
};

export default function ProjectsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: projects = [], isLoading } = useProjects();
  const { data: allContracts = [] } = useContracts();
  const { data: allTasks = [] } = useTasks({});
  const { user } = useAuthStore();
  const deleteProject = useDeleteProject();
  const archiveProject = useArchiveProject();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const STATUS_MAP: Record<ProjectStatus, { label: string; color: string }> = {
    planning: { label: t.projects.planning, color: STATUS_COLORS.planning },
    active: { label: t.projects.active, color: STATUS_COLORS.active },
    paused: { label: t.projects.paused, color: STATUS_COLORS.paused },
    completed: { label: t.projects.completed, color: STATUS_COLORS.completed },
    archived: { label: t.projects.archived, color: STATUS_COLORS.archived },
  };

  const isAdminOrLeader = user && canCreateProject(user.role as UserRole);

  // Collect project IDs from tasks the user can see (RLS-filtered)
  const myTaskProjectIds = new Set(
    allTasks.filter((t: any) => t.project_id).map((t: any) => t.project_id)
  );

  // Filter projects: admin/leader see all; others see projects they participate in
  const visibleProjects = isAdminOrLeader
    ? projects
    : projects.filter((p) => {
        if (!user) return false;
        // 1. User's department is explicitly assigned to this project
        if (user.dept_id && p.departments?.some((pd: any) => pd.dept?.id === user.dept_id)) return true;
        // 2. User has tasks in this project (RLS already filters tasks by dept/team/assignee)
        if (myTaskProjectIds.has(p.id)) return true;
        // 3. User is the project manager
        if (p.manager_id === user.id) return true;
        return false;
      });

  const filtered = visibleProjects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = debouncedSearch.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
    return true;
  });

  const activeCount = visibleProjects.filter((p) => p.status === "active").length;
  const activeContracts = (allContracts as any[]).filter((c) => ["active", "completed"].includes(c.status));
  const projectBudgetMap = new Map<string, number>();
  const projectFundMap = new Map<string, number>();
  for (const c of activeContracts) {
    const val = Number(c.contract_value);
    if (c.contract_type === "outgoing") projectBudgetMap.set(c.project_id, (projectBudgetMap.get(c.project_id) || 0) + val);
    else if (c.contract_type === "incoming") projectFundMap.set(c.project_id, (projectFundMap.get(c.project_id) || 0) + val);
  }
  const totalBudget = visibleProjects.reduce((s, p) => s + (projectBudgetMap.get(p.id) || 0), 0);
  const totalFund = visibleProjects.reduce((s, p) => s + (projectFundMap.get(p.id) || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.projects.pageTitle}</h1>
          <p className="text-base text-muted-foreground mt-0.5">
            {t.projects.stats.replace("{total}", String(visibleProjects.length)).replace("{active}", String(activeCount))}
          </p>
        </div>
        {isAdminOrLeader && (
          <Button variant="primary" onClick={() => router.push("/projects/new")}>
            {t.projects.newProject}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t.projects.totalProjects} value={visibleProjects.length} accentColor="hsl(var(--primary))" />
        <StatCard label={t.projects.activeLbl} value={activeCount} accentColor="#3b82f6" />
        <StatCard label={t.projects.totalBudget} value={formatVND(totalBudget)} accentColor="#10b981" />
        <StatCard label={t.projects.allocationFundLbl} value={formatVND(totalFund)} accentColor="#f59e0b" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          {t.common.all} ({visibleProjects.length})
        </FilterChip>
        {(["active", "planning", "paused", "completed"] as ProjectStatus[]).map((s) => {
          const count = visibleProjects.filter((p) => p.status === s).length;
          return (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {STATUS_MAP[s].label} ({count})
            </FilterChip>
          );
        })}

        <div className="w-px h-6 bg-border" />

        <div className="relative ml-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.projects.searchPlaceholder}
            className="w-48 h-10 pl-8 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
        </div>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          {(["grid", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {v === "grid" ? `▦ ${t.projects.gridView}` : `≡ ${t.projects.listView}`}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 size={32} strokeWidth={1.5} />} title={t.projects.noProjects} subtitle={t.projects.noProjectsSub} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              contractBudget={projectBudgetMap.get(project.id) || 0}
              taskCount={allTasks.filter((t) => t.project_id === project.id).length}
              overdueCount={allTasks.filter((t) => t.project_id === project.id && t.status === "overdue").length}
              onClick={() => router.push(`/projects/${project.id}`)}
              canManage={!!isAdminOrLeader}
              onArchive={() => setArchiveTarget(project)}
              onDelete={() => setDeleteTarget(project)}
            />
          ))}
        </div>
      ) : (
        <ProjectListView
          projects={filtered}
          allTasks={allTasks}
          projectBudgetMap={projectBudgetMap}
          projectFundMap={projectFundMap}
          onClick={(id) => router.push(`/projects/${id}`)}
          canManage={!!isAdminOrLeader}
          onArchive={(p) => setArchiveTarget(p)}
          onDelete={(p) => setDeleteTarget(p)}
        />
      )}

      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent title={t.projects.archiveProject} size="sm">
          <p className="text-base text-muted-foreground">
            {t.projects.archiveConfirm} <strong className="text-foreground">{archiveTarget?.name}</strong> ({archiveTarget?.code})?
          </p>
          <p className="text-sm text-amber-600 mt-2">{t.projects.archiveWarn}</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setArchiveTarget(null)} className="px-4 py-2 text-base rounded-lg border border-border hover:bg-secondary transition-colors">
              {t.common.cancel}
            </button>
            <button
              onClick={() => archiveTarget && archiveProject.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) })}
              disabled={archiveProject.isPending}
              className="px-4 py-2 text-base rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {archiveProject.isPending ? "..." : t.projects.archiveProject}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent title={t.projects.deleteProject} size="sm">
          <p className="text-base text-muted-foreground">
            {t.projects.deleteConfirm} <strong className="text-foreground">{deleteTarget?.name}</strong> ({deleteTarget?.code})?
          </p>
          <p className="text-sm text-destructive mt-2">{t.projects.deleteWarn}</p>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-base rounded-lg border border-border hover:bg-secondary transition-colors">
              {t.common.cancel}
            </button>
            <button
              onClick={() => deleteTarget && deleteProject.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
              disabled={deleteProject.isPending}
              className="px-4 py-2 text-base rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleteProject.isPending ? t.common.deleting : t.projects.deleteProject}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectCard({
  project,
  contractBudget,
  taskCount,
  overdueCount,
  onClick,
  canManage,
  onArchive,
  onDelete,
}: {
  project: Project;
  contractBudget: number;
  taskCount: number;
  overdueCount: number;
  onClick: () => void;
  canManage?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const statusLabel = {
    planning: t.projects.planning,
    active: t.projects.active,
    paused: t.projects.paused,
    completed: t.projects.completed,
    archived: t.projects.archived,
  }[project.status];
  const statusColor = STATUS_COLORS[project.status];
  const health = overdueCount > 2 ? "red" : overdueCount > 0 ? "yellow" : taskCount === 0 ? "gray" : "green";
  const progress = project.progress ?? 0;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group relative"
    >
      {/* Status bar */}
      <div className="h-[3px]" style={{ background: statusColor }} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded">
                {project.code}
              </span>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded"
                style={{ background: `${statusColor}18`, color: statusColor }}
              >
                {statusLabel}
              </span>
            </div>
            <h3 className="text-base font-bold mt-1.5 group-hover:text-primary transition-colors line-clamp-2">
              {project.name}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <HealthBadge health={health as any} />
            {canManage && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-sm"
                  title={t.common.options}
                >
                  ···
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                    <div className="absolute right-0 top-7 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onClick(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        {t.projects.editProject}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onArchive?.(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        {t.projects.archiveProject}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete?.(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        {t.projects.deleteProject}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {project.client && <p>{t.projects.client}: <span className="text-foreground font-medium">{project.client}</span></p>}
          <p>
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
          </p>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">{t.projects.progressLabel}</span>
            <span className="font-mono text-sm font-semibold">{progress}%</span>
          </div>
          <ProgressBar value={progress} showText={false} />
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-muted-foreground">{taskCount} {t.projects.tasksCol.toLowerCase()}</span>
            {overdueCount > 0 && (
              <span className="text-destructive font-semibold">{overdueCount} {t.projects.overdueLbl}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {project.manager && (
              <UserAvatar
                name={project.manager.full_name}
                color={ROLE_CONFIG[project.manager.role]?.color}
                size="xs"
              />
            )}
            {contractBudget > 0 && (
              <span className="font-mono text-[11px] text-primary font-semibold">
                {formatVND(contractBudget)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectListView({
  projects,
  allTasks,
  projectBudgetMap,
  projectFundMap,
  onClick,
  canManage,
  onArchive,
  onDelete,
}: {
  projects: Project[];
  allTasks: any[];
  projectBudgetMap: Map<string, number>;
  projectFundMap: Map<string, number>;
  onClick: (id: string) => void;
  canManage?: boolean;
  onArchive?: (p: Project) => void;
  onDelete?: (p: Project) => void;
}) {
  const { t } = useI18n();

  const getStatusLabel = (status: ProjectStatus) => ({
    planning: t.projects.planning,
    active: t.projects.active,
    paused: t.projects.paused,
    completed: t.projects.completed,
    archived: t.projects.archived,
  }[status]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/50 sticky top-0 z-10">
            {[t.projects.projectCode, t.projects.projectName, t.projects.statusCol, t.projects.manager, t.projects.progressLabel, t.projects.tasksCol, t.projects.totalBudget, t.projects.allocationFundLbl, t.projects.deadlineCol, ...(canManage ? [""] : [])].map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const statusColor = STATUS_COLORS[p.status];
            const label = getStatusLabel(p.status);
            const pTasks = allTasks.filter((t: any) => t.project_id === p.id);
            const overdue = pTasks.filter((t: any) => t.status === "overdue").length;
            return (
              <tr
                key={p.id}
                onClick={() => onClick(p.id)}
                className="border-b border-border/40 hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-primary font-bold">{p.code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-base font-medium truncate max-w-[250px] block">{p.name}</span>
                  {p.client && <span className="text-[11px] text-muted-foreground">{p.client}</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: `${statusColor}18`, color: statusColor }}
                  >
                    {label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.manager ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar name={p.manager.full_name} color={ROLE_CONFIG[p.manager.role]?.color} size="xs" />
                      <span className="text-sm truncate max-w-[80px]">{p.manager.full_name}</span>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ProgressBar value={p.progress ?? 0} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">{pTasks.length}</span>
                  {overdue > 0 && <span className="text-destructive text-[11px] ml-1">({overdue} {t.projects.lateLbl})</span>}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                  {(projectBudgetMap.get(p.id) || 0) > 0 ? formatVND(projectBudgetMap.get(p.id)!) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-amber-500 font-semibold">
                  {(projectFundMap.get(p.id) || 0) > 0 ? formatVND(projectFundMap.get(p.id)!) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                  {formatDate(p.end_date)}
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onArchive?.(p); }}
                        className="text-xs px-2 py-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title={t.projects.archiveProject}
                      >
                        {t.projects.archiveProject}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete?.(p); }}
                        className="text-xs px-2 py-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
                        title={t.projects.deleteProject}
                      >
                        {t.projects.deleteProject}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
