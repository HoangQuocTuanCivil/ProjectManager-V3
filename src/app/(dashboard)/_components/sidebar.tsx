"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useNotifStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/shared/tooltip";
import { NAV_ITEMS, SETTINGS_ITEM } from "./nav-config";

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
                        {"badge" in item && item.badge === "tasks" && unreadCount > 0 && (
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

      {/* Bottom spacer */}
      <div className="border-t border-border px-3 py-2" />
    </>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
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

export { SidebarContent };
