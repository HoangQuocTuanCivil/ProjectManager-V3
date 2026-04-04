"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import { Building2, Users, Building, UsersRound, ShieldCheck, Target, FileText, Bell, Lock, User, Landmark } from "lucide-react";

const SETTINGS_ITEMS = [
  { href: "/settings/profile", tKey: "profile" as const, icon: <User size={18} />, roles: ["admin", "leader", "head", "team_leader"] },
  { href: "/settings/organization", tKey: "organization" as const, icon: <Building2 size={18} />, roles: ["admin", "leader", "head"] },
  { href: "/settings/accounts", tKey: "accounts" as const, icon: <Users size={18} />, roles: ["admin", "leader", "head"] },
  { href: "/settings/centers", tKey: "centers" as const, icon: <Landmark size={18} />, roles: ["admin", "leader"] },
  { href: "/settings/departments", tKey: "departments" as const, icon: <Building size={18} />, roles: ["admin", "leader"] },
  { href: "/settings/teams", tKey: "teams" as const, icon: <UsersRound size={18} />, roles: ["admin", "leader", "head"] },
  { href: "/settings/roles", tKey: "roles" as const, icon: <ShieldCheck size={18} />, roles: ["admin", "leader"] },
  { href: "/settings/kpi", tKey: "kpiConfig" as const, icon: <Target size={18} />, roles: ["admin", "leader"] },
  { href: "/settings/templates", tKey: "templates" as const, icon: <FileText size={18} />, roles: ["admin", "leader", "head"] },
  { href: "/settings/notifications", tKey: "notifications" as const, icon: <Bell size={18} />, roles: ["admin", "leader", "head"] },
  { href: "/settings/security", tKey: "security" as const, icon: <Lock size={18} />, roles: ["admin", "leader", "head"] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useI18n();

  const visibleNav = useMemo(() =>
    SETTINGS_ITEMS
      .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
      .map((item) => ({ ...item, label: t.settings[item.tKey] })),
    [user, t]
  );

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 animate-fade-in">
      {/* Mobile: horizontal scrollable tabs */}
      <div className="md:hidden">
        <h2 className="text-lg font-bold mb-3">{t.nav.settings}</h2>
        <nav className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-all border",
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span className="w-4 flex items-center justify-center">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Desktop: sidebar nav */}
      <aside className="w-[220px] flex-shrink-0 hidden md:block">
        <h2 className="text-lg font-bold mb-4">{t.nav.settings}</h2>
        <nav className="space-y-1" role="navigation" aria-label={t.nav.settings}>
          {visibleNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-[450] transition-all text-left",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
