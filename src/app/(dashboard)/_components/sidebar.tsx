"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useNotifStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/shared/tooltip";
import { NAV_ITEMS } from "./nav-config";

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

  // Build nav items with translated labels (settings removed — accessible via topbar account menu)
  const navItems = NAV_ITEMS.map((item) => ({ ...item, label: t.nav[item.tKey], roles: undefined as string[] | undefined }));

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
        <div className="space-y-1">
          {navItems
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
            .map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              const isHome = item.href === "/" && pathname === "/";
              const active = isActive || isHome;
              const hasChildren = item.children && item.children.length > 0;

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

              // Render parent item + expandable sub-items when parent is active
              return (
                <div key={item.href}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">{navButton}</Tooltip>
                  ) : (
                    navButton
                  )}

                  {/* Sub-navigation items — shown when parent is active and sidebar is expanded */}
                  {hasChildren && active && !collapsed && (
                    <div className="ml-8 mt-0.5 mb-1 space-y-0.5 border-l-2 border-primary/20 pl-3">
                      {item.children!.map((child) => {
                        const childActive = pathname === child.href;
                        const childLabel = (t.nav as any)[child.tKey] || child.tKey;
                        return (
                          <button
                            key={child.href}
                            onClick={() => handleNav(child.href)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded-md text-[13px] font-[430] transition-all",
                              childActive
                                ? "text-primary font-semibold bg-primary/5"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                          >
                            {childLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
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
