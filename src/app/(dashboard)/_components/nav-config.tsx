import {
  LayoutDashboard, ClipboardList, Building2, Target, Rocket,
  Zap, BarChart3, Settings,
} from "lucide-react";

export interface NavItemConfig {
  href: string;
  icon: React.ReactNode;
  tKey: "overview" | "tasks" | "projects" | "kpi" | "goals" | "workflow" | "reports" | "settings";
  badge?: string;
  roles?: string[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: <LayoutDashboard size={20} />, tKey: "overview" },
  { href: "/tasks", icon: <ClipboardList size={20} />, tKey: "tasks", badge: "tasks" },
  { href: "/projects", icon: <Building2 size={20} />, tKey: "projects" },
  { href: "/kpi", icon: <Target size={20} />, tKey: "kpi" },
  { href: "/goals", icon: <Rocket size={20} />, tKey: "goals" },
  { href: "/workflows", icon: <Zap size={20} />, tKey: "workflow" },
  { href: "/reports", icon: <BarChart3 size={20} />, tKey: "reports" },
];

// Settings removed from sidebar — accessible only via user account dropdown in topbar

export const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "overview",
  "/tasks": "taskManagement",
  "/projects": "projectPortfolio",
  "/kpi": "kpiAllocation",
  "/goals": "goalsOkr",
  "/workflows": "workflowApproval",
  "/reports": "reports",
  "/settings": "systemSettings",
  "/notifications": "notifications",
};
