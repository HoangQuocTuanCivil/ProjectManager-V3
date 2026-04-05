import {
  LayoutDashboard, ClipboardList, Building2, Target, Rocket,
  Zap, BarChart3, FileText, TrendingUp,
} from "lucide-react";

export interface NavSubItem {
  href: string;
  tKey: string;
}

export interface NavItemConfig {
  href: string;
  icon: React.ReactNode;
  tKey: "overview" | "tasks" | "projects" | "kpi" | "contractManagement" | "revenue" | "goals" | "workflow" | "reports";
  badge?: string;
  roles?: string[];
  /** Sub-navigation items displayed beneath the parent when active */
  children?: NavSubItem[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: <LayoutDashboard size={20} />, tKey: "overview" },
  { href: "/tasks", icon: <ClipboardList size={20} />, tKey: "tasks", badge: "tasks" },
  { href: "/projects", icon: <Building2 size={20} />, tKey: "projects" },
  {
    href: "/kpi",
    icon: <Target size={20} />,
    tKey: "kpi",
    children: [
      { href: "/kpi", tKey: "kpiOverview" },
      { href: "/kpi/allocation", tKey: "kpiAllocation" },
      { href: "/kpi/config", tKey: "kpiConfig" },
    ],
  },
  {
    href: "/contracts",
    icon: <FileText size={20} />,
    tKey: "contractManagement",
    children: [
      { href: "/contracts", tKey: "contracts" },
      { href: "/contracts/budget-assign", tKey: "budgetAssignTab" },
    ],
  },
  {
    href: "/revenue",
    icon: <TrendingUp size={20} />,
    tKey: "revenue",
    children: [
      { href: "/revenue", tKey: "companyRevenue" },
      { href: "/revenue/departments", tKey: "deptAllocation" },
      { href: "/revenue/internal", tKey: "internalRevenue" },
      { href: "/revenue/costs", tKey: "costs" },
      { href: "/reports", tKey: "reports" },
    ],
  },
  { href: "/goals", icon: <Rocket size={20} />, tKey: "goals" },
  { href: "/workflows", icon: <Zap size={20} />, tKey: "workflow" },
  { href: "/reports", icon: <BarChart3 size={20} />, tKey: "reports" },
];

export const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "overview",
  "/tasks": "taskManagement",
  "/projects": "projectPortfolio",
  "/kpi": "kpiAllocation",
  "/kpi/allocation": "kpiAllocation",
  "/kpi/config": "kpiAllocation",
  "/contracts": "contractManagement",
  "/contracts/budget-assign": "contractManagement",
  "/revenue": "revenueManagement",
  "/revenue/internal": "revenueManagement",
  "/revenue/costs": "revenueManagement",
  "/revenue/departments": "revenueManagement",
  "/goals": "goalsOkr",
  "/workflows": "workflowApproval",
  "/reports": "reports",
  "/settings": "systemSettings",
  "/notifications": "notifications",
};
