"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useNotifStore } from "@/lib/stores";
import { useSignOut } from "@/lib/hooks/use-users";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { Search, Bell, Menu, Settings, LogOut, User, KeyRound, Building2, Users, Building, UsersRound, ShieldCheck, Target, FileText, Landmark, Package } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

function UserMenu() {
  const { user } = useAuthStore();
  const signOut = useSignOut();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Show placeholder avatar while auth state is loading
  if (!user) {
    return (
      <div className="flex items-center gap-2.5 h-10 pl-2 pr-3">
        <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
        <div className="hidden md:block space-y-1">
          <div className="w-20 h-3 bg-secondary rounded animate-pulse" />
          <div className="w-12 h-2 bg-secondary rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const initials = user.full_name.split(" ").map((w) => w[0]).slice(-2).join("");
  const roleColor = ROLE_CONFIG[user.role]?.color ?? "#6366f1";
  const roleLabel = ROLE_CONFIG[user.role]?.label ?? user.role;

  return (
    <div className="relative" ref={ref}>
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 h-10 pl-2 pr-3 rounded-lg hover:bg-secondary transition-colors"
        aria-label="Menu tài khoản"
        aria-expanded={open}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.full_name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: roleColor }}
          >
            {initials}
          </div>
        )}
        <div className="hidden md:block text-left min-w-0">
          <p className="text-sm font-semibold leading-tight truncate max-w-[120px]">{user.full_name}</p>
          <p className="text-[10px] leading-tight truncate" style={{ color: roleColor }}>{roleLabel}</p>
        </div>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          {/* Settings menu items — filtered by user role */}
          <div className="py-1 max-h-[320px] overflow-y-auto">
            {[
              { href: "/settings/profile", label: "Hồ sơ cá nhân", icon: <User size={15} />, roles: ["admin", "leader", "director", "head", "team_leader", "staff"] },
              { href: "/settings/security", label: "Bảo mật", icon: <KeyRound size={15} />, roles: ["admin", "leader", "director", "head", "team_leader", "staff"] },
              { href: "/settings/organization", label: "Tổ chức", icon: <Building2 size={15} />, roles: ["admin", "leader", "head"] },
              { href: "/settings/accounts", label: "Tài khoản", icon: <Users size={15} />, roles: ["admin"] },
              { href: "/settings/centers", label: "Trung tâm", icon: <Landmark size={15} />, roles: ["admin"] },
              { href: "/settings/departments", label: "Phòng ban", icon: <Building size={15} />, roles: ["admin", "leader"] },
              { href: "/settings/teams", label: "Nhóm", icon: <UsersRound size={15} />, roles: ["admin", "leader"] },
              { href: "/settings/roles", label: "Vai trò & Phân quyền", icon: <ShieldCheck size={15} />, roles: ["admin"] },
              { href: "/settings/kpi", label: "Cấu hình KPI", icon: <Target size={15} />, roles: ["admin", "leader"] },
              { href: "/settings/templates", label: "Mẫu công việc", icon: <FileText size={15} />, roles: ["admin", "leader", "head"] },
              { href: "/settings/product-services", label: "Sản phẩm/Dịch vụ", icon: <Package size={15} />, roles: ["admin", "leader", "director"] },
            ]
              .filter((item) => user && item.roles.includes(user.role))
              .map((item) => (
                <button
                  key={item.href}
                  onClick={() => { router.push(item.href); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  {item.label}
                </button>
              ))}
          </div>

          {/* Logout */}
          <div className="border-t border-border py-1">
            <button
              onClick={() => signOut.mutate()}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={15} />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({
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
        {/* Notifications */}
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
        {/* User account menu */}
        <UserMenu />
      </div>
    </header>
  );
}
