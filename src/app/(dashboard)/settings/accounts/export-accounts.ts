import ExcelJS from "exceljs";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";

interface ExportUser {
  full_name: string;
  employee_code?: string;
  email: string;
  role: string;
  job_title?: string;
  center_id?: string;
  dept_id?: string;
  team_id?: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  department?: { name?: string; code?: string; center_id?: string };
  team?: { name?: string };
}

interface RefItem {
  id: string;
  name: string;
  code?: string | null;
}

interface ExportOptions {
  users: ExportUser[];
  centers: (RefItem & { director_id?: string | null })[];
  departments: (RefItem & { center_id?: string | null; [k: string]: unknown })[];
  teams: (RefItem & { dept_id?: string | null })[];
}

const ROLE_LABELS = Object.entries(ROLE_CONFIG).map(
  ([, cfg]) => cfg.label
);

const ROLE_ENTRIES = Object.entries(ROLE_CONFIG) as [string, { label: string }][];

function roleLabelToKey(label: string): string {
  return ROLE_ENTRIES.find(([, cfg]) => cfg.label === label)?.[0] ?? label;
}

export async function exportAccountsExcel({
  users,
  centers,
  departments,
  teams,
}: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách tài khoản");
  const refSheet = wb.addWorksheet("DanhMuc");

  // --- Reference sheet for lookups ---
  refSheet.getColumn(1).header = "Trung tâm";
  refSheet.getColumn(2).header = "Mã TT";
  refSheet.getColumn(3).header = "Phòng ban";
  refSheet.getColumn(4).header = "Mã PB";
  refSheet.getColumn(5).header = "Nhóm";
  refSheet.getColumn(6).header = "Vai trò";

  const maxRows = Math.max(centers.length, departments.length, teams.length, ROLE_LABELS.length);
  for (let i = 0; i < maxRows; i++) {
    const row = refSheet.getRow(i + 2);
    if (i < centers.length) {
      row.getCell(1).value = centers[i].name;
      row.getCell(2).value = centers[i].code ?? "";
    }
    if (i < departments.length) {
      row.getCell(3).value = departments[i].name;
      row.getCell(4).value = departments[i].code ?? "";
    }
    if (i < teams.length) {
      row.getCell(5).value = teams[i].name;
    }
    if (i < ROLE_LABELS.length) {
      row.getCell(6).value = ROLE_LABELS[i];
    }
  }

  refSheet.state = "veryHidden";

  // --- Define named ranges for data validation ---
  const centerRange = `DanhMuc!$A$2:$A$${centers.length + 1}`;
  const deptRange = `DanhMuc!$C$2:$C$${departments.length + 1}`;
  const teamRange = `DanhMuc!$E$2:$E$${teams.length + 1}`;
  const roleRange = `DanhMuc!$F$2:$F$${ROLE_LABELS.length + 1}`;

  // --- Main sheet columns ---
  ws.columns = [
    { header: "Họ tên", key: "full_name", width: 22 },
    { header: "Mã hệ thống", key: "employee_code", width: 14 },
    { header: "Email", key: "email", width: 28 },
    { header: "Vai trò", key: "role", width: 16 },
    { header: "Chức danh", key: "job_title", width: 18 },
    { header: "Trung tâm", key: "center_name", width: 20 },
    { header: "Mã trung tâm", key: "center_code", width: 14 },
    { header: "Phòng ban", key: "dept_name", width: 20 },
    { header: "Mã phòng ban", key: "dept_code", width: 14 },
    { header: "Nhóm", key: "team_name", width: 16 },
    { header: "Số điện thoại", key: "phone", width: 14 },
    { header: "Trạng thái", key: "status", width: 12 },
    { header: "Đăng nhập cuối", key: "last_login", width: 14 },
    { header: "Ngày tạo", key: "created_at", width: 14 },
  ];

  // Header style
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2F2F2" },
    };
    cell.alignment = { vertical: "middle" };
  });

  // --- Build lookup maps ---
  const centerMap = new Map(centers.map((c) => [c.id, c]));
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  // --- Populate data rows ---
  for (const u of users) {
    const center =
      centerMap.get(u.center_id ?? "") ??
      centerMap.get(u.department?.center_id ?? "");
    const roleLabel =
      ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.label ?? u.role;

    ws.addRow({
      full_name: u.full_name,
      employee_code: u.employee_code ?? "",
      email: u.email,
      role: roleLabel,
      job_title: u.job_title ?? "",
      center_name: center?.name ?? "",
      center_code: center?.code ?? "",
      dept_name: u.department?.name ?? "",
      dept_code: u.department?.code ?? "",
      team_name: u.team?.name ?? "",
      phone: u.phone ?? "",
      status: u.is_active ? "Hoạt động" : "Đã khóa",
      last_login: u.last_login ? formatDate(u.last_login) : "Chưa",
      created_at: formatDate(u.created_at),
    });
  }

  // --- Apply data validations (dropdowns) to data columns ---
  const dataRowCount = Math.max(users.length, 50);
  const startRow = 2;
  const endRow = startRow + dataRowCount;

  // Col D (4) = Vai trò
  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(r, 4).dataValidation = {
      type: "list",
      formulae: [roleRange],
      showErrorMessage: true,
      errorTitle: "Giá trị không hợp lệ",
      error: "Vui lòng chọn vai trò từ danh sách",
    };
  }

  // Col F (6) = Trung tâm
  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(r, 6).dataValidation = {
      type: "list",
      formulae: [centerRange],
      showErrorMessage: true,
      errorTitle: "Giá trị không hợp lệ",
      error: "Vui lòng chọn trung tâm từ danh sách",
    };
  }

  // Col G (7) = Mã trung tâm — VLOOKUP from Trung tâm
  for (let r = startRow; r <= endRow; r++) {
    const cell = ws.getCell(r, 7);
    if (!cell.value) {
      cell.value = {
        formula: `IF(F${r}="","",VLOOKUP(F${r},DanhMuc!$A:$B,2,FALSE))`,
      } as ExcelJS.CellFormulaValue;
    }
  }

  // Col H (8) = Phòng ban
  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(r, 8).dataValidation = {
      type: "list",
      formulae: [deptRange],
      showErrorMessage: true,
      errorTitle: "Giá trị không hợp lệ",
      error: "Vui lòng chọn phòng ban từ danh sách",
    };
  }

  // Col I (9) = Mã phòng ban — VLOOKUP from Phòng ban
  for (let r = startRow; r <= endRow; r++) {
    const cell = ws.getCell(r, 9);
    if (!cell.value) {
      cell.value = {
        formula: `IF(H${r}="","",VLOOKUP(H${r},DanhMuc!$C:$D,2,FALSE))`,
      } as ExcelJS.CellFormulaValue;
    }
  }

  // Col J (10) = Nhóm
  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(r, 10).dataValidation = {
      type: "list",
      formulae: [teamRange],
      showErrorMessage: true,
      errorTitle: "Giá trị không hợp lệ",
      error: "Vui lòng chọn nhóm từ danh sách",
    };
  }

  // --- Generate and download ---
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Danh_sach_tai_khoan_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  return users.length;
}
