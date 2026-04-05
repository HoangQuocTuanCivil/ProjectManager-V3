import * as XLSX from "xlsx";
import type { RevenueEntry, DeptRevenueAllocation, RevenueSummary } from "@/lib/types";

interface ExportData {
  entries: RevenueEntry[];
  summary?: RevenueSummary | null;
  allocations?: DeptRevenueAllocation[];
}

const STATUS_MAP: Record<string, string> = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  adjusted: "Đã điều chỉnh",
  cancelled: "Đã huỷ",
};

const DIM_MAP: Record<string, string> = {
  project: "Dự án",
  contract: "Hợp đồng",
  period: "Giai đoạn",
  product_service: "SP/DV",
};

const METHOD_MAP: Record<string, string> = {
  acceptance: "Nghiệm thu",
  completion_rate: "Tỷ lệ hoàn thành",
  time_based: "Theo thời gian",
};

function buildSummarySheet(summary: RevenueSummary): XLSX.WorkSheet {
  const rows = [
    ["Tổng doanh thu", summary.total],
    ["Doanh thu nháp", summary.draft],
    ["Tăng trưởng (%)", summary.growthRate ?? "—"],
    [],
    ["Theo chiều quản trị"],
    ...Object.entries(summary.byDimension).map(([k, v]) => [DIM_MAP[k] ?? k, v]),
    [],
    ["Theo phương pháp"],
    ...Object.entries(summary.byMethod).map(([k, v]) => [METHOD_MAP[k] ?? k, v]),
    [],
    ["Theo nguồn"],
    ...Object.entries(summary.bySource).map(([k, v]) => [k, v]),
  ];
  return XLSX.utils.aoa_to_sheet([["Chỉ tiêu", "Giá trị"], ...rows]);
}

function buildEntriesSheet(entries: RevenueEntry[]): XLSX.WorkSheet {
  const headers = ["Mô tả", "Trạng thái", "Chiều QT", "Phương pháp", "Nguồn", "Dự án", "Phòng ban", "Số tiền", "Ngày ghi nhận", "% Hoàn thành"];
  const rows = entries.map(e => [
    e.description,
    STATUS_MAP[e.status ?? "draft"] ?? e.status,
    DIM_MAP[e.dimension] ?? e.dimension,
    METHOD_MAP[e.method] ?? e.method,
    e.source,
    (e as any).project?.code ?? "",
    (e as any).department?.code ?? "",
    Number(e.amount),
    e.recognition_date ?? "",
    e.completion_percentage ?? "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 10 }];
  return ws;
}

function buildAllocationsSheet(allocations: DeptRevenueAllocation[]): XLSX.WorkSheet {
  const headers = ["Phòng ban", "Mã PB", "Tỷ lệ (%)", "Số tiền phân bổ", "Dự án"];
  const rows = allocations.map(a => [
    (a as any).department?.name ?? "",
    (a as any).department?.code ?? "",
    a.allocation_percentage,
    Number(a.allocated_amount),
    (a as any).project?.code ?? "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
  return ws;
}

export function exportRevenueExcel({ entries, summary, allocations }: ExportData) {
  const wb = XLSX.utils.book_new();

  if (summary) {
    XLSX.utils.book_append_sheet(wb, buildSummarySheet(summary), "Tổng hợp");
  }

  XLSX.utils.book_append_sheet(wb, buildEntriesSheet(entries), "Chi tiết");

  if (allocations && allocations.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildAllocationsSheet(allocations), "Phân bổ PB");
  }

  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Doanh_thu_${date}.xlsx`);
}

export function exportRevenuePDF() {
  window.print();
}
