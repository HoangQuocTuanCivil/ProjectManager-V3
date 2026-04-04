"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Tổng quan",
  "/tasks": "Công việc",
  "/tasks/templates": "Mẫu công việc",
  "/projects": "Dự án",
  "/projects/new": "Tạo dự án",
  "/kpi": "KPI & Khoán",
  "/kpi/allocation": "Đợt khoán",
  "/kpi/allocation/new": "Tạo đợt khoán",
  "/kpi/budget-assign": "Giao khoán",
  "/kpi/contracts": "Hợp đồng đầu ra",
  "/kpi/config": "Cấu hình",
  "/kpi/evaluation": "Nghiệm thu",
  "/kpi/records": "Lịch sử KPI",
  "/goals": "Goals & OKR",
  "/goals/new": "Tạo mục tiêu",
  "/workflows": "Workflow",
  "/workflows/new": "Tạo quy trình",
  "/reports": "Báo cáo",
  "/reports/progress": "Tiến độ",
  "/reports/kpi-summary": "KPI",
  "/reports/allocation-summary": "Khoán",
  "/reports/custom": "Tùy chỉnh",
  "/notifications": "Thông báo",
  "/settings": "Cài đặt",
  "/settings/organization": "Tổ chức",
  "/settings/accounts": "Tài khoản",
  "/settings/departments": "Phòng ban",
  "/settings/roles": "Vai trò",
  "/settings/kpi": "KPI",
  "/settings/templates": "Mẫu",
  "/settings/notifications": "Thông báo",
  "/settings/security": "Bảo mật",
};

/**
 * Auto-generated breadcrumbs from the current pathname.
 * Resolves labels from ROUTE_LABELS; falls back to humanized path segments.
 * For dynamic [id] segments it shows "Chi tiết".
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [];

  let cumulativePath = "";
  for (const seg of segments) {
    cumulativePath += `/${seg}`;
    // Check if this looks like a UUID (dynamic segment)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(seg);
    const label =
      ROUTE_LABELS[cumulativePath] ||
      (isUUID ? "Chi tiết" : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "));
    crumbs.push({ href: cumulativePath, label });
  }

  return (
    <nav className="flex items-center gap-1 text-[12px] mb-3" aria-label="Breadcrumb">
      <Link
        href="/"
        className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
      >
        <Home size={14} />
      </Link>
      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="inline-flex items-center gap-1">
          <ChevronRight size={11} className="text-muted-foreground/50" />
          {idx === crumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
