"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useModuleAccess } from "@/features/settings/hooks/use-module-access";
import { NAV_ITEMS } from "./nav-config";

/** Map pathname → moduleKey để kiểm tra quyền truy cập */
function getModuleKeyFromPath(pathname: string): string | null {
  // Tìm nav item khớp với pathname (ưu tiên match dài nhất)
  const match = NAV_ITEMS
    .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.moduleKey ?? null;
}

/** Redirect về trang chủ nếu user truy cập module bị ẩn */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: disabledModules, isLoading } = useModuleAccess();

  const moduleKey = getModuleKeyFromPath(pathname);

  useEffect(() => {
    if (isLoading || !disabledModules || !moduleKey) return;
    if (disabledModules.has(moduleKey)) {
      router.replace("/");
    }
  }, [disabledModules, moduleKey, isLoading, router]);

  // Chưa load xong hoặc module bị ẩn → không render children
  if (!isLoading && disabledModules && moduleKey && disabledModules.has(moduleKey)) {
    return null;
  }

  return <>{children}</>;
}
