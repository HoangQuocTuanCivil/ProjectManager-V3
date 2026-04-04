"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuthStore, useNotifStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { useSignOut } from "@/lib/hooks/use-data";
import { useI18n, type Locale } from "@/lib/i18n";
import {
  LayoutDashboard, ClipboardList, Building2, Target, Rocket,
  Zap, BarChart3, Settings, Search, Bell, Sun, Moon,
  PanelLeftClose, PanelLeftOpen, Menu, X, LogOut, Globe,
} from "lucide-react";
import { CommandPalette } from "@/components/shared/command-palette";
import { Tooltip, TooltipProvider } from "@/components/shared/tooltip";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  roles?: string[];
}

// Navigation items use translation keys - resolved in SidebarContent
const NAV_ITEMS = [
  { href: "/", icon: <LayoutDashboard size={20} />, tKey: "overview" as const },
  { href: "/tasks", icon: <ClipboardList size={20} />, tKey: "tasks" as const, badge: "tasks" },
  { href: "/projects", icon: <Building2 size={20} />, tKey: "projects" as const },
  { href: "/kpi", icon: <Target size={20} />, tKey: "kpi" as const },
  { href: "/goals", icon: <Rocket size={20} />, tKey: "goals" as const },
  { href: "/workflows", icon: <Zap size={20} />, tKey: "workflow" as const },
  { href: "/reports", icon: <BarChart3 size={20} />, tKey: "reports" as const },
];

const SETTINGS_ITEM = { href: "/settings/profile", icon: <Settings size={20} />, tKey: "settings" as const, roles: ["admin", "leader", "head", "team_leader"] };

const PAGE_TITLE_KEYS: Record<string, string> = {
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


function VNFlag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 2 / 3)} viewBox="0 0 30 20" className="rounded-[2px] shadow-sm border border-border/30">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon points="15,4 16.8,9.5 22.5,9.5 17.8,12.8 19.5,18.2 15,15 10.5,18.2 12.2,12.8 7.5,9.5 13.2,9.5" fill="#FFFF00" />
    </svg>
  );
}

function UKFlag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 2 / 3)} viewBox="0 0 60 30" className="rounded-[2px] shadow-sm border border-border/30">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}


function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-10 px-2 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
        title={locale === "vi" ? "Tiếng Việt" : "English"}
      >
        {locale === "vi" ? <VNFlag size={22} /> : <UKFlag size={22} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden min-w-[150px]">
            <button
              onClick={() => { setLocale("vi"); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors", locale === "vi" && "bg-primary/10 text-primary font-semibold")}
            >
              <VNFlag size={20} />
              <span>Tiếng Việt</span>
            </button>
            <button
              onClick={() => { setLocale("en"); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors", locale === "en" && "bg-primary/10 text-primary font-semibold")}
            >
              <UKFlag size={20} />
              <span>English</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const label = theme === "dark" ? t.misc.switchToLight : t.misc.switchToDark;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors text-base"
      title={label}
      aria-label={label}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function SidebarContent({
  collapsed,
  onToggle,
  onNavClick,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { unreadCount } = useNotifStore();
  const signOut = useSignOut();
  const { t } = useI18n();

  const handleNav = (href: string) => {
    router.push(href);
    onNavClick?.();
  };

  // Build nav sections with translated labels
  const navSections = [
    {
      title: t.nav.main,
      items: NAV_ITEMS.map((item) => ({ ...item, label: t.nav[item.tKey], roles: undefined as string[] | undefined })),
    },
    {
      title: t.nav.settingsSection,
      items: [{ ...SETTINGS_ITEM, label: t.nav[SETTINGS_ITEM.tKey] }],
    },
  ];

  return (
    <>
      {/* Brand */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <button onClick={() => handleNav("/")} className="text-left">
            <h1 className="text-[17px] font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              A2Z WorkHub
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-[1.5px] uppercase mt-0.5">
              {t.pages.taskManagement} & KPI
            </p>
          </button>
        )}
        <button
          onClick={onToggle}
          className="w-7 h-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hidden md:flex"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4" role="navigation" aria-label="Menu">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && (
              <p className="text-[11px] uppercase tracking-[1.6px] text-muted-foreground px-3 py-2 font-semibold">
                {section.title}
              </p>
            )}
            <div className="space-y-1.5">
            {section.items
              .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
              .map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
                const isHome = item.href === "/" && pathname === "/";
                const active = isActive || isHome;
                const navButton = (
                  <button
                    key={item.href}
                    onClick={() => handleNav(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg text-sm font-[450] transition-all",
                      collapsed ? "px-0 py-3 justify-center" : "px-3 py-3",
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <span className="w-5 flex items-center justify-center flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge === "tasks" && unreadCount > 0 && (
                          <span className="ml-auto bg-destructive text-white text-[11px] px-1.5 py-0.5 rounded-full font-semibold">
                            {unreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
                if (collapsed) {
                  return (
                    <Tooltip key={item.href} content={item.label} side="right">
                      {navButton}
                    </Tooltip>
                  );
                }
                return navButton;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: User Info & Actions */}
      <div className="border-t border-border">
        {user && (
          <button 
            onClick={() => handleNav('/settings/profile')}
            className={cn("w-full px-3 py-3 flex items-center gap-2.5 hover:bg-secondary transition-colors text-left border-b border-border/50", collapsed && "justify-center")}
            aria-label="Cài đặt tài khoản"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ background: ROLE_CONFIG[user.role]?.color ?? "#6366f1" }}
              >
                {user.full_name.split(" ").map((w) => w[0]).slice(-2).join("")}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-tight">{user.full_name}</p>
                <p className="text-[11px] text-primary truncate mt-0.5">{user.job_title ?? ROLE_CONFIG[user.role]?.label}</p>
              </div>
            )}
          </button>
        )}
        <div className="px-3 py-2">
          <button
            onClick={() => signOut.mutate()}
            className={cn("w-full h-9 rounded-lg flex items-center text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors gap-2", collapsed ? "justify-center" : "px-3")}
            aria-label="Đăng xuất"
          >
            <LogOut size={14} /> {!collapsed && "Đăng xuất"}
          </button>
        </div>
      </div>
    </>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "bg-card border-r border-border flex-col h-full transition-all duration-200 flex-shrink-0 hidden md:flex",
        collapsed ? "w-[68px] min-w-[68px]" : "w-[250px] min-w-[250px]"
      )}
    >
      <TooltipProvider>
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </TooltipProvider>
    </aside>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-card border-r border-border flex flex-col transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="w-7 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground" aria-label="Đóng menu">
            <X size={18} />
          </button>
        </div>
        <SidebarContent collapsed={false} onToggle={() => {}} onNavClick={onClose} />
      </aside>
    </>
  );
}

function Topbar({
  title,
  onMenuClick,
  onSearchClick,
}: {
  title: string;
  onMenuClick: () => void;
  onSearchClick: () => void;
}) {
  const { unreadCount } = useNotifStore();
  const router = useRouter();
  const isMac = useMemo(() => typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent), []);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  return (
    <header className="h-14 px-4 md:px-6 flex items-center justify-between border-b border-border bg-card flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors md:hidden"
          aria-label="Mở menu"
        >
          <Menu size={18} />
        </button>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search trigger */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex w-52 h-10 pl-3 pr-3 rounded-lg border border-border bg-secondary text-sm text-muted-foreground items-center gap-2 hover:border-primary/50 transition-colors"
          aria-label={`Tìm kiếm (${shortcutLabel})`}
        >
          <Search size={14} />
          <span>Tìm kiếm... ({shortcutLabel})</span>
        </button>
        <button
          onClick={onSearchClick}
          className="md:hidden w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
          aria-label="Tìm kiếm"
        >
          <Search size={18} />
        </button>
        <LanguageSwitcher />
        <ThemeToggle />
        <button
          onClick={() => router.push("/notifications")}
          className="relative w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
          aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo"}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { t } = useI18n();
  const titleKey = PAGE_TITLE_KEYS[pathname] ?? Object.entries(PAGE_TITLE_KEYS).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1];
  const title = titleKey ? (t.pages as any)[titleKey] || titleKey : "A2Z WorkHub";

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden flex shrink-0 h-full">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <div className="print:hidden">
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <Topbar
            title={title}
            onMenuClick={() => setMobileOpen(true)}
            onSearchClick={() => setCmdOpen(true)}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          <div className="print:hidden">
            <Breadcrumbs />
          </div>
          {children}
        </div>
      </main>
      <div className="print:hidden">
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      </div>
    </div>
  );
}
