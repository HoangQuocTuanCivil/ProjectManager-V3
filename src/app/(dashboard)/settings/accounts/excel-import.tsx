"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import * as XLSX from "xlsx";
import { Button, EmptyState } from "@/components/shared";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

/**
 * Các cột trong mẫu Excel import tài khoản.
 * Thứ tự và tên cột khớp với bảng danh sách tài khoản hiển thị trên giao diện.
 */
const TEMPLATE_COLUMNS = [
  { header: "Họ tên (*)", key: "full_name" },
  { header: "Mã hệ thống", key: "employee_code" },
  { header: "Email (*)", key: "email" },
  { header: "Mật khẩu (*)", key: "password" },
  { header: "Vai trò", key: "role" },
  { header: "Chức danh", key: "job_title" },
  { header: "Trung tâm (mã)", key: "center_code" },
  { header: "Phòng ban (mã)", key: "dept_code" },
  { header: "Nhóm (mã)", key: "team_code" },
  { header: "Số điện thoại", key: "phone" },
] as const;

/** Valid role values that the system accepts */
const VALID_ROLES = ["admin", "leader", "director", "head", "team_leader", "staff"];

interface ParsedRow {
  rowNum: number;
  full_name: string;
  employee_code: string;
  email: string;
  password: string;
  role: string;
  job_title: string;
  center_code: string;
  dept_code: string;
  team_code: string;
  phone: string;
  errors: string[];
  status: "pending" | "creating" | "success" | "error";
  statusMsg?: string;
}

/**
 * Downloads an Excel template file with predefined headers and an example row.
 * Users fill this template with employee data then import it back.
 */
function downloadTemplate() {
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const exampleRow = [
    "Nguyễn Văn A", "DC12345", "nguyenvana@company.com", "Pass@1234",
    "staff", "Kỹ sư BIM", "TT-TK1", "BIM", "", "0912345678",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

  ws["!cols"] = [
    { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh sách tài khoản");
  XLSX.writeFile(wb, "Mau_Tao_Tai_Khoan.xlsx");
}

/**
 * Parses an uploaded Excel file into structured rows with validation.
 * Checks required fields (name, email, password) and role validity.
 */
function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (jsonRows.length === 0) {
          reject(new Error("File không có dữ liệu"));
          return;
        }

        // Map Vietnamese headers to internal keys
        const headerMap: Record<string, string> = {};
        TEMPLATE_COLUMNS.forEach((c) => { headerMap[c.header] = c.key; });

        const parsed: ParsedRow[] = jsonRows.map((row, idx) => {
          const mapped: any = { rowNum: idx + 2, errors: [], status: "pending" };

          // Resolve each column by matching header name to key
          for (const col of TEMPLATE_COLUMNS) {
            const value = (row[col.header] ?? "").toString().trim();
            mapped[col.key] = value;
          }

          // Validate required fields
          if (!mapped.full_name) mapped.errors.push("Thiếu họ tên");
          if (!mapped.email) mapped.errors.push("Thiếu email");
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) mapped.errors.push("Email không hợp lệ");
          if (!mapped.password) mapped.errors.push("Thiếu mật khẩu");
          else if (mapped.password.length < 6) mapped.errors.push("Mật khẩu < 6 ký tự");

          // Default role to staff if empty or invalid
          if (!mapped.role) mapped.role = "staff";
          else if (!VALID_ROLES.includes(mapped.role.toLowerCase())) {
            mapped.errors.push(`Vai trò "${mapped.role}" không hợp lệ`);
          } else {
            mapped.role = mapped.role.toLowerCase();
          }

          return mapped as ParsedRow;
        });

        resolve(parsed);
      } catch {
        reject(new Error("Không thể đọc file Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file"));
    reader.readAsArrayBuffer(file);
  });
}

interface ExcelImportProps {
  /** Maps department code → ID for resolving dept_code from Excel */
  deptCodeMap: Map<string, string>;
  /** Maps team code → ID for resolving team_code from Excel */
  teamCodeMap: Map<string, string>;
  /** Maps center code → ID for resolving center_code from Excel */
  centerCodeMap: Map<string, string>;
  /** Called after successful import to refresh the user list */
  onComplete: () => void;
}

/** Methods exposed to parent via ref for triggering import and template download */
export interface ExcelImportHandle {
  triggerImport: () => void;
  downloadTemplate: () => void;
}

export const ExcelImportButton = forwardRef<ExcelImportHandle, ExcelImportProps>(function ExcelImportButton({ deptCodeMap, teamCodeMap, centerCodeMap, onComplete }, ref) {
  const [showModal, setShowModal] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    triggerImport: () => fileRef.current?.click(),
    downloadTemplate,
  }));

  /** Handles file selection — parses Excel and shows preview */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const parsed = await parseExcelFile(file);
      setRows(parsed);
      setShowModal(true);
    } catch (err: any) {
      toast.error(err.message || "Lỗi đọc file");
    }

    // Reset input so the same file can be selected again
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Creates accounts one by one via the /api/users endpoint */
  const handleImport = async () => {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("Không có dòng hợp lệ để import");
      return;
    }

    setImporting(true);
    let successCount = 0;

    for (const row of validRows) {
      // Update UI to show progress
      setRows((prev) => prev.map((r) => r.rowNum === row.rowNum ? { ...r, status: "creating" } : r));

      try {
        const dept_id = row.dept_code ? (deptCodeMap.get(row.dept_code) || "") : "";
        const team_id = row.team_code ? (teamCodeMap.get(row.team_code) || "") : "";
        const center_id = row.center_code ? (centerCodeMap.get(row.center_code) || "") : "";

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: row.full_name,
            employee_code: row.employee_code || undefined,
            email: row.email,
            password: row.password,
            role: row.role,
            job_title: row.job_title || undefined,
            center_id: center_id || undefined,
            dept_id: dept_id || undefined,
            team_id: team_id || undefined,
            phone: row.phone || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi tạo tài khoản");

        setRows((prev) => prev.map((r) => r.rowNum === row.rowNum ? { ...r, status: "success", statusMsg: "Thành công" } : r));
        successCount++;
      } catch (err: any) {
        setRows((prev) => prev.map((r) => r.rowNum === row.rowNum ? { ...r, status: "error", statusMsg: err.message } : r));
      }
    }

    setImporting(false);
    toast.success(`Đã tạo ${successCount}/${validRows.length} tài khoản`);
    if (successCount > 0) onComplete();
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  /** Programmatically opens the file picker — called from parent dropdown menu */
  const triggerFileSelect = () => fileRef.current?.click();

  return (
    <>
      {/* Hidden file input — triggered programmatically via triggerFileSelect() */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

      {/* Preview + import modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => !importing && setShowModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-green-600" />
                <div>
                  <h3 className="text-base font-bold">Import tài khoản từ Excel</h3>
                  <p className="text-xs text-muted-foreground">{fileName} — {rows.length} dòng ({validCount} hợp lệ, {errorCount} lỗi)</p>
                </div>
              </div>
              <button onClick={() => !importing && setShowModal(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded" aria-label="Đóng" disabled={importing}>&times;</button>
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-auto px-5 py-3">
              {rows.length === 0 ? (
                <EmptyState icon={<FileText size={32} strokeWidth={1.5} />} title="File rỗng" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Họ tên</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Mã HT</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Vai trò</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Chức danh</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Trung tâm</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Phòng ban</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Nhóm</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SĐT</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-32">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNum} className={`border-b border-border/30 ${row.errors.length > 0 ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                        <td className="px-3 py-2 text-muted-foreground">{row.rowNum}</td>
                        <td className="px-3 py-2 font-medium">{row.full_name || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.employee_code || "—"}</td>
                        <td className="px-3 py-2">{row.email || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2">{row.role}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.job_title || "—"}</td>
                        <td className="px-3 py-2">{row.center_code || "—"}</td>
                        <td className="px-3 py-2">{row.dept_code || "—"}</td>
                        <td className="px-3 py-2">{row.team_code || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.phone || "—"}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-red-500 text-xs flex items-center gap-1"><XCircle size={13} /> {row.errors[0]}</span>
                          ) : row.status === "creating" ? (
                            <span className="text-blue-500 text-xs flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Đang tạo...</span>
                          ) : row.status === "success" ? (
                            <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle size={13} /> Thành công</span>
                          ) : row.status === "error" ? (
                            <span className="text-red-500 text-xs flex items-center gap-1"><XCircle size={13} /> {row.statusMsg}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sẵn sàng</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Vai trò hợp lệ: admin, leader, director, head, team_leader, staff
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setShowModal(false)} disabled={importing}>Hủy</Button>
                <Button variant="primary" onClick={handleImport} disabled={importing || validCount === 0}>
                  {importing ? "Đang import..." : `Import ${validCount} tài khoản`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
