"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  Search, ClipboardList, Building2, Target, Rocket, Zap,
  BarChart3, Settings, Bell, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  href: string;
  group: string;
}

const QUICK_LINKS: CommandItem[] = [
  { id: "nav-overview", label: "Tổng quan", icon: <BarChart3 size={18} />, href: "/", group: "Trang" },
  { id: "nav-tasks", label: "Công việc", icon: <ClipboardList size={18} />, href: "/tasks", group: "Trang" },
  { id: "nav-projects", label: "Dự án", icon: <Building2 size={18} />, href: "/projects", group: "Trang" },
  { id: "nav-kpi", label: "KPI & Khoán", icon: <Target size={18} />, href: "/kpi", group: "Trang" },
  { id: "nav-goals", label: "Goals & OKR", icon: <Rocket size={18} />, href: "/goals", group: "Trang" },
  { id: "nav-workflows", label: "Workflow", icon: <Zap size={18} />, href: "/workflows", group: "Trang" },
  { id: "nav-reports", label: "Báo cáo", icon: <BarChart3 size={18} />, href: "/reports", group: "Trang" },
  { id: "nav-settings", label: "Cài đặt", icon: <Settings size={18} />, href: "/settings/accounts", group: "Trang" },
  { id: "nav-notif", label: "Thông báo", icon: <Bell size={18} />, href: "/notifications", group: "Trang" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: tasks = [] } = useTasks({});
  const { data: projects = [] } = useProjects();

  // Build search items
  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [...QUICK_LINKS];

    tasks.slice(0, 50).forEach((t) => {
      items.push({
        id: `task-${t.id}`,
        label: t.title,
        sublabel: t.project?.code,
        icon: <ClipboardList size={18} />,
        href: "/tasks",
        group: "Công việc",
      });
    });

    projects.forEach((p) => {
      items.push({
        id: `proj-${p.id}`,
        label: p.name,
        sublabel: p.code,
        icon: <Building2 size={18} />,
        href: `/projects/${p.id}`,
        group: "Dự án",
      });
    });

    return items;
  }, [tasks, projects]);

  const filtered = useMemo(() => {
    if (!query) return QUICK_LINKS;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel?.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  // Group items
  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      const arr = map.get(item.group) || [];
      arr.push(item);
      map.set(item.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
    if (open) setQuery("");
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        router.push(filtered[activeIndex].href);
        onOpenChange(false);
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, activeIndex, router, onOpenChange]);

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => onOpenChange(false)}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in" />
      {/* Dialog */}
      <div className="relative flex items-start justify-center pt-[15vh]">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[560px] mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-in-bottom"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={18} className="text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm trang, công việc, dự án..."
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="hidden md:inline-flex text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border font-mono">
              ESC
            </kbd>
            <button onClick={() => onOpenChange(false)} className="md:hidden text-muted-foreground">
              <X size={18} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-base text-muted-foreground">Không tìm thấy kết quả</p>
              </div>
            ) : (
              groups.map(([group, items]) => (
                <div key={group}>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">
                    {group}
                  </p>
                  {items.map((item) => {
                    flatIdx++;
                    const idx = flatIdx;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          router.push(item.href);
                          onOpenChange(false);
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          activeIndex === idx
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-secondary/50"
                        )}
                      >
                        <span className="text-muted-foreground flex-shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                        </div>
                        {item.sublabel && (
                          <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {item.sublabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>↑↓ điều hướng</span>
            <span>↵ chọn</span>
            <span>ESC đóng</span>
          </div>
        </div>
      </div>
    </div>
  );
}
