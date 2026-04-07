"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCreateProject } from "@/lib/hooks/use-projects";
import { useUsers } from "@/lib/hooks/use-users";
import { useAuthStore } from "@/lib/stores";
import { canCreateProject } from "@/lib/utils/permissions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/shared";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import type { UserRole, Department } from "@/lib/types";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data as Department[];
    },
  });
}

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useCreateProject();
  const { data: users = [] } = useUsers();
  const { data: departments = [] } = useDepartments();
  const { user } = useAuthStore();

  // Role guard: only admin/leader can create projects
  useEffect(() => {
    if (user && !canCreateProject(user.role as UserRole)) {
      router.replace("/projects");
    }
  }, [user, router]);

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    manager_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    status: "planning" as const,
  });

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);

  const update = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const toggleDept = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Vui lòng nhập mã và tên dự án");
      return;
    }
    try {
      await createProject.mutateAsync({ ...form, dept_ids: selectedDeptIds });
      toast.success("Tạo dự án thành công!");
      router.push("/projects");
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("projects_org_id_code_key")) {
        toast.error(`Mã dự án "${form.code}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        toast.error(msg || "Lỗi tạo dự án");
      }
    }
  };

  if (user && !canCreateProject(user.role as UserRole)) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-primary mb-2">
          ← Quay lại danh sách
        </button>
        <h1 className="text-xl font-bold">Tạo dự án mới</h1>
        <p className="text-base text-muted-foreground mt-0.5">Nhập thông tin dự án và cấu hình ban đầu</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">1</span>
              Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-8">
              <div>
                <label className="text-sm text-muted-foreground font-medium">Mã dự án *</label>
                <input
                  value={form.code}
                  onChange={(e) => update("code", e.target.value.toUpperCase())}
                  placeholder="VD: DA-HP-2026"
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Trạng thái</label>
                <SearchSelect
                  value={form.status}
                  onChange={(val) => update("status", val)}
                  options={[
                    { value: "planning", label: "Chuẩn bị" },
                    { value: "active", label: "Đang triển khai" },
                  ]}
                  placeholder="Chọn trạng thái..."
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground font-medium">Tên dự án *</label>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="VD: Cầu Hồng Phong — Gói thầu số 3"
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-medium focus:border-primary focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={3}
                  placeholder="Mô tả phạm vi, scope, yêu cầu chính..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Management */}
          <div>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">2</span>
              Quản lý & Thời gian
            </h3>
            <div className="grid grid-cols-2 gap-4 pl-8">
              <div>
                <label className="text-sm text-muted-foreground font-medium">Chủ nhiệm dự án</label>
                <SearchSelect
                  value={form.manager_id}
                  onChange={(val) => update("manager_id", val)}
                  options={users
                    .filter((u: any) => ["admin", "leader", "head"].includes(u.role))
                    .map((u: any) => ({
                      value: u.id,
                      label: u.full_name,
                      sublabel: u.email,
                    }))}
                  placeholder="Chọn người quản lý..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => update("start_date", e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Ngày kết thúc</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => update("end_date", e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Department Assignment */}
          <div>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">3</span>
              Giao cho phòng ban
            </h3>
            <div className="pl-8">
              <p className="text-sm text-muted-foreground mb-3">
                Chọn các phòng ban thực hiện dự án. Chỉ thành viên thuộc phòng ban được chọn mới thấy dự án này.
              </p>
              {departments.length === 0 ? (
                <p className="text-base text-muted-foreground">Chưa có phòng ban nào</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {departments.map((dept) => (
                    <label
                      key={dept.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedDeptIds.includes(dept.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDeptIds.includes(dept.id)}
                        onChange={() => toggleDept(dept.id)}
                        className="accent-primary w-4 h-4"
                      />
                      <div>
                        <span className="text-base font-medium">{dept.name}</span>
                        {dept.code && (
                          <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">({dept.code})</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedDeptIds.length > 0 && (
                <p className="text-sm text-primary mt-2 font-medium">
                  Đã chọn {selectedDeptIds.length} phòng ban
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-secondary/30">
          <Button onClick={() => router.back()}>Hủy</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={createProject.isPending || !form.code.trim() || !form.name.trim()}
          >
            {createProject.isPending ? "Đang tạo..." : "Tạo dự án"}
          </Button>
        </div>
      </div>
    </div>
  );
}
