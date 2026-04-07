import * as XLSX from "xlsx";

interface ContractRow {
  contract_no: string;
  title: string;
  project_code: string;
  signed_date: string;
  contract_value: number;
  contract_scope: string;
  product_service_name: string;
}

interface ExportRevenueData {
  contracts: ContractRow[];
  totalRevenue: number;
  internal: number;
  external: number;
}

const SCOPE_LABEL: Record<string, string> = {
  internal: "Trong hệ thống",
  external: "Ngoài hệ thống",
};

function buildSummarySheet(data: ExportRevenueData): XLSX.WorkSheet {
  const rows = [
    ["Tổng doanh thu", data.totalRevenue],
    ["Trong hệ thống", data.internal],
    ["Ngoài hệ thống", data.external],
    ["Số hợp đồng", data.contracts.length],
  ];
  return XLSX.utils.aoa_to_sheet([["Chỉ tiêu", "Giá trị"], ...rows]);
}

function buildContractsSheet(contracts: ContractRow[]): XLSX.WorkSheet {
  const headers = ["Mã HĐ", "Tên hợp đồng", "Dự án", "Ngày ký", "Giá trị HĐ", "Loại hình", "Lĩnh vực SP/DV"];
  const rows = contracts.map((c) => [
    c.contract_no,
    c.title,
    c.project_code,
    c.signed_date,
    c.contract_value,
    SCOPE_LABEL[c.contract_scope] || c.contract_scope,
    c.product_service_name,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [
    { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 14 },
    { wch: 20 }, { wch: 16 }, { wch: 20 },
  ];
  return ws;
}

export function exportRevenueExcel(data: ExportRevenueData) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), "Tổng hợp");
  XLSX.utils.book_append_sheet(wb, buildContractsSheet(data.contracts), "Chi tiết hợp đồng");
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Doanh_thu_${date}.xlsx`);
}

export function exportRevenuePDF() {
  window.print();
}
