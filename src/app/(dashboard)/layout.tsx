"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { CommandPalette } from "@/components/shared/command-palette";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PAGE_TITLE_KEYS } from "./_components/nav-config";
import { Sidebar } from "./_components/sidebar";
import { MobileDrawer } from "./_components/mobile-drawer";
import { Topbar } from "./_components/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { t } = useI18n();
  const titleKey = PAGE_TITLE_KEYS[pathname] ?? Object.entries(PAGE_TITLE_KEYS).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1];
  const title = titleKey ? (t.pages as any)[titleKey] || titleKey : "A2Z WorkHub";

  // Cmd+K / Ctrl+K shortcut
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
      {/* Skip-to-content link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium">
        Chuyển đến nội dung chính
      </a>
      <div className="print:hidden flex shrink-0 h-full">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>
      <div className="print:hidden">
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
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
