"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateProposal } from "@/lib/hooks/use-proposals";
import { useProjects } from "@/lib/hooks/use-projects";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { toast } from "sonner";
import type { UserRole } from "@/lib/types";

const ROLE_LEVEL: Record<string, number> = {
  admin: 5, director: 4, leader: 4, head: 3, team_leader: 2, staff: 1,
};

// Fetch ONLY users with higher role — bypasses dept-scoped /api/users
function useApprovers(myRole: string) {
  const myLevel = ROLE_LEVEL[myRole] || 1;
  // Determine which roles are higher
  const higherRoles = Object.entries(ROLE_LEVEL)
    .filter(([, level]) => level > myLevel)
    .map(([role]) => role);

  return useQuery({
    queryKey: ["approvers", myRole],
    queryFn: async () => {
      if (higherRoles.length === 0) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, avatar_url")
        .in("role", higherRoles as UserRole[])
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: higherRoles.length > 0,
  });
}

export function ProposalForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const { data: approvers = [] } = useApprovers(user?.role || "staff");
  const { data: projects = [] } = useProjects();
  const createProposal = useCreateProposal();

  const [form, setForm] = useState({
    title: "",
    description: "",
    approver_id: "",
    project_id: "",
    priority: "medium",
    task_type: "task" as "task" | "product",
    kpi_weight: 5,
    start_date: new Date().toISOString().slice(0, 10),
    deadline: "",
  });

  // Approvers already filtered by role level from useApprovers hook
  const approverOptions = useMemo(() => {
    if (!user) return [];
    return (approvers as any[])
      .filter((u: any) => u.id !== user.id)
      .map((u: any) => ({
        value: u.id,
        label: `${u.full_name} — ${(ROLE_CONFIG as any)[u.role]?.label || u.role}`,
      }));
  }, [approvers, user]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Vui lòng nhập tên công việc"); return; }
    if (!form.approver_id) { toast.error("Vui lòng chọn người duyệt"); return; }
    try {
      await createProposal.mutateAsync(form);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Lỗi gửi đề xuất");
    }
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">📝 Đề xuất giao việc</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className={labelClass}>Tên công việc *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Mô tả công việc cần đề xuất..."
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Mô tả chi tiết</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Nội dung, yêu cầu, mục tiêu..."
              rows={3}
              className={inputClass + " h-auto py-2 resize-none"}
            />
          </div>

          {/* Approver */}
          <div>
            <label className={labelClass}>Người duyệt *</label>
            <SearchSelect
              value={form.approver_id}
              onChange={(val) => setForm({ ...form, approver_id: val })}
              options={approverOptions}
              placeholder="Chọn người duyệt (cấp trên)..."
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Chỉ hiển thị người có vai trò cao hơn bạn</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className={labelClass}>Ưu tiên</label>
              <SearchSelect
                value={form.priority}
                onChange={(val) => setForm({ ...form, priority: val })}
                options={[
                  { value: "low", label: "Thấp" },
                  { value: "medium", label: "Trung bình" },
                  { value: "high", label: "Cao" },
                  { value: "urgent", label: "Khẩn cấp" },
                ]}
                placeholder="Ưu tiên"
                className="mt-1"
              />
            </div>

            {/* Task Type */}
            <div>
              <label className={labelClass}>Loại</label>
              <SearchSelect
                value={form.task_type}
                onChange={(val) => setForm({ ...form, task_type: val as any })}
                options={[
                  { value: "task", label: "Công việc" },
                  { value: "product", label: "Sản phẩm" },
                ]}
                placeholder="Loại"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Project */}
            <div>
              <label className={labelClass}>Dự án (tùy chọn)</label>
              <SearchSelect
                value={form.project_id}
                onChange={(val) => setForm({ ...form, project_id: val })}
                options={projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                placeholder="— Không —"
                className="mt-1"
              />
            </div>

            {/* KPI Weight */}
            <div>
              <label className={labelClass}>Trọng số KPI (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.kpi_weight}
                onChange={(e) => setForm({ ...form, kpi_weight: parseInt(e.target.value) || 5 })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Start Date */}
            <div>
              <label className={labelClass}>Ngày bắt đầu</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            </div>

            {/* Deadline */}
            <div>
              <label className={labelClass}>Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createProposal.isPending}>
            {createProposal.isPending ? "Đang gửi..." : "Gửi đề xuất"}
          </Button>
        </div>
      </div>
    </div>
  );
}
