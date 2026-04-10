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
  /** Module key dùng cho phân quyền truy cập module */
  moduleKey: string;
  badge?: string;
  roles?: string[];
  /** Sub-navigation items displayed beneath the parent when active */
  children?: NavSubItem[];
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: "/", icon: <LayoutGrid {...ICON_PROPS} />, tKey: "overview", moduleKey: "overview" },
  { href: "/tasks", icon: <ClipboardList {...ICON_PROPS} />, tKey: "tasks", moduleKey: "tasks", badge: "tasks" },
  { href: "/projects", icon: <Building2 {...ICON_PROPS} />, tKey: "projects", moduleKey: "projects" },
  {
    href: "/kpi",
    icon: <Target {...ICON_PROPS} />,
    tKey: "kpi",
    moduleKey: "kpi",
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
    moduleKey: "contracts",
    children: [
      { href: "/contracts", tKey: "contracts" },
      { href: "/contracts/budget-assign", tKey: "budgetAssignTab" },
      { href: "/contracts/acceptance", tKey: "contractAcceptance" },
    ],
  },
  {
    href: "/revenue",
    icon: <TrendingUp {...ICON_PROPS} />,
    tKey: "revenue",
    moduleKey: "revenue",
    children: [
      { href: "/revenue", tKey: "companyRevenue" },
      { href: "/revenue/allocation", tKey: "deptAllocation" },
    ],
  },
  { href: "/revenue/costs", icon: <Receipt {...ICON_PROPS} />, tKey: "costs", moduleKey: "costs" },
  { href: "/goals", icon: <Flag {...ICON_PROPS} />, tKey: "goals", moduleKey: "goals" },
  { href: "/workflows", icon: <Zap {...ICON_PROPS} />, tKey: "workflow", moduleKey: "workflow" },
  { href: "/reports", icon: <BarChart3 {...ICON_PROPS} />, tKey: "reports", moduleKey: "reports" },
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
  "/reports/business": "reports",
  "/revenue/allocation": "revenueManagement",
  "/goals": "goalsOkr",
  "/workflows": "workflowApproval",
  "/reports": "reports",
  "/settings/module-access": "systemSettings",
  "/settings": "systemSettings",
  "/notifications": "notifications",
};
