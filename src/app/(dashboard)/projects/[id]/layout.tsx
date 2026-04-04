"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { useProject } from "@/lib/hooks/use-projects";
import { cn } from "@/lib/utils/cn";
import { HealthBadge, ProgressBar } from "@/components/shared";
import { formatDate, formatVND } from "@/lib/utils/kpi";

const PROJECT_TABS = [
  { href: "", label: "Tổng quan", icon: "📊" },
  { href: "/tasks", label: "Công việc", icon: "📋" },
  { href: "/members", label: "Thành viên", icon: "👥" },
  { href: "/milestones", label: "Milestones", icon: "◆" },
  { href: "/acceptance", label: "Nghiệm thu", icon: "✅" },
  { href: "/allocation", label: "Chia khoán", icon: "💰" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const projectId = params.id as string;
  const { data: project, isLoading } = useProject(projectId);

  const basePath = `/projects/${projectId}`;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-card border border-border rounded-xl" />
        <div className="h-10 bg-card border border-border rounded-xl w-96" />
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-4xl mb-4">❌</p>
        <h2 className="text-lg font-bold mb-2">Không tìm thấy dự án</h2>
        <button onClick={() => router.push("/projects")} className="text-base text-primary hover:underline mt-2">
          ← Quay lại danh sách
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    planning: "#94a3b8", active: "#3b82f6", paused: "#f59e0b", completed: "#10b981", archived: "#6b7280",
  };
  const statusLabels: Record<string, string> = {
    planning: "Chuẩn bị", active: "Đang triển khai", paused: "Tạm dừng", completed: "Hoàn thành", archived: "Lưu trữ",
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back link */}
      <button onClick={() => router.push("/projects")} className="text-sm text-muted-foreground hover:text-primary">
        ← Dự án & Portfolio
      </button>

      {/* Project Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-base text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                {project.code}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: `${statusColors[project.status]}18`, color: statusColors[project.status] }}
              >
                {statusLabels[project.status]}
              </span>
              <HealthBadge health={project.health ?? "gray"} />
            </div>
            <h1 className="text-lg font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-base text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p className="font-mono text-lg font-bold text-amber-500">{formatVND(project.allocation_fund)}</p>
            <p className="text-[11px] text-muted-foreground">Quỹ khoán</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
          {project.client && <span>KH: <span className="text-foreground font-medium">{project.client}</span></span>}
          {project.contract_no && <span>HĐ: <span className="font-mono text-foreground">{project.contract_no}</span></span>}
          {project.location && <span>📍 {project.location}</span>}
          <span>{formatDate(project.start_date)} → {formatDate(project.end_date)}</span>
          {project.budget > 0 && <span>Ngân sách: <span className="font-mono text-foreground">{formatVND(project.budget)}</span></span>}
        </div>

        {/* Progress */}
        <div className="mt-3">
          <ProgressBar value={project.progress ?? 0} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {PROJECT_TABS.map((tab) => {
          const fullPath = basePath + tab.href;
          const isActive = tab.href === ""
            ? pathname === basePath
            : pathname.startsWith(fullPath);
          return (
            <button
              key={tab.href}
              onClick={() => router.push(fullPath)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
