import {
  LayoutGrid, ClipboardList, Building2, Target, Flag,
  Zap, BarChart3, FileText, TrendingUp, Receipt,
} from "lucide-react";

const ICON_PROPS = { size: 20, strokeWidth: 1.5 } as const;

export interface NavSubItem {
  href: string;
  tKey: string;
}

export interface NavItemConfig {
  href: string;
  icon: React.ReactNode;
  tKey: "overview" | "tasks" | "projects" | "kpi" | "contractManagement" | "revenue" | "costs" | "goals" | "workflow" | "reports";
  badge?: string;
  roles?: string[];
  /** Sub-navigation items displayed beneath the parent when active */
  children?: NavSubItem[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: <LayoutGrid {...ICON_PROPS} />, tKey: "overview" },
  { href: "/tasks", icon: <ClipboardList {...ICON_PROPS} />, tKey: "tasks", badge: "tasks" },
  { href: "/projects", icon: <Building2 {...ICON_PROPS} />, tKey: "projects" },
  {
    href: "/kpi",
    icon: <Target {...ICON_PROPS} />,
    tKey: "kpi",
    children: [
      { href: "/kpi", tKey: "kpiOverview" },
      { href: "/kpi/allocation", tKey: "kpiAllocation" },
      { href: "/kpi/config", tKey: "kpiConfig" },
    ],
  },
  {
    href: "/contracts",
    icon: <FileText {...ICON_PROPS} />,
    tKey: "contractManagement",
    children: [
      { href: "/contracts", tKey: "contracts" },
      { href: "/contracts/budget-assign", tKey: "budgetAssignTab" },
      { href: "/contracts/acceptance", tKey: "contractAcceptance" },
      { href: "/contracts/reports", tKey: "contractReports" },
    ],
  },
  {
    href: "/revenue",
    icon: <TrendingUp {...ICON_PROPS} />,
    tKey: "revenue",
    children: [
      { href: "/revenue", tKey: "companyRevenue" },
      { href: "/revenue/allocation", tKey: "deptAllocation" },
      { href: "/revenue/internal", tKey: "internalRevenue" },
    ],
  },
  { href: "/revenue/costs", icon: <Receipt {...ICON_PROPS} />, tKey: "costs" },
  { href: "/goals", icon: <Flag {...ICON_PROPS} />, tKey: "goals" },
  { href: "/workflows", icon: <Zap {...ICON_PROPS} />, tKey: "workflow" },
  { href: "/reports", icon: <BarChart3 {...ICON_PROPS} />, tKey: "reports" },
];

export const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "overview",
  "/tasks": "taskManagement",
  "/projects": "projectPortfolio",
  "/kpi": "kpiAllocation",
  "/kpi/allocation": "kpiAllocation",
  "/kpi/config": "kpiAllocation",
  "/kpi/salary": "costs",
  "/contracts": "contractManagement",
  "/contracts/budget-assign": "contractManagement",
  "/contracts/acceptance": "contractManagement",
  "/contracts/reports": "contractManagement",
  "/revenue": "revenueManagement",
  "/revenue/internal": "revenueManagement",
  "/revenue/costs": "costs",
  "/revenue/allocation": "revenueManagement",
  "/goals": "goalsOkr",
  "/workflows": "workflowApproval",
  "/reports": "reports",
  "/settings": "systemSettings",
  "/notifications": "notifications",
};
