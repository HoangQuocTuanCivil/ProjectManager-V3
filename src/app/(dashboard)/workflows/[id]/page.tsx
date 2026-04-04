"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkflow, useToggleWorkflow, useUpdateWorkflow, useDeleteWorkflow } from "@/lib/hooks/use-workflows";
import { Section, Toggle, Button, EmptyState, StatCard } from "@/components/shared";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";

const STEP_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  create: { icon: "✏️", color: "#38bdf8", label: "Tạo" },
  assign: { icon: "👤", color: "#06b6d4", label: "Gán" },
  execute: { icon: "⚡", color: "#10b981", label: "Thực hiện" },
  submit: { icon: "📤", color: "#8b5cf6", label: "Nộp" },
  review: { icon: "🔍", color: "#f59e0b", label: "Kiểm tra" },
  approve: { icon: "✅", color: "#10b981", label: "Duyệt" },
  reject: { icon: "❌", color: "#ef4444", label: "Từ chối" },
  revise: { icon: "🔄", color: "#f97316", label: "Sửa lại" },
  calculate: { icon: "🔢", color: "#6366f1", label: "Tính toán" },
  notify: { icon: "🔔", color: "#ec4899", label: "Thông báo" },
  archive: { icon: "📦", color: "#64748b", label: "Lưu trữ" },
  custom: { icon: "⚙️", color: "#94a3b8", label: "Tùy chỉnh" },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  staff: { label: "Nhân viên", color: "#10b981" },
  head: { label: "Trưởng phòng", color: "#3b82f6" },
  leader: { label: "Lãnh đạo", color: "#f59e0b" },
  admin: { label: "Admin", color: "#ef4444" },
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const { data: workflow, isLoading } = useWorkflow(workflowId);
  const toggleWorkflow = useToggleWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const handleDelete = async () => {
    if (!confirm("Bạn chắc chắn muốn xóa workflow này? Thao tác không thể hoàn tác.")) return;
    try {
      await deleteWorkflow.mutateAsync(workflowId);
      toast.success("Đã xóa workflow");
      router.push("/workflows");
    } catch (e: any) {
      toast.error(e.message || "Lỗi xóa workflow");
    }
  };

  const startEdit = () => {
    if (!workflow) return;
    setEditForm({
      name: workflow.name,
      description: workflow.description || "",
      scope: workflow.scope || "global",
      is_default: workflow.is_default || false,
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) { toast.error("Tên workflow là bắt buộc"); return; }
    try {
      await updateWorkflow.mutateAsync({ id: workflowId, ...editForm });
      toast.success("Cập nhật workflow thành công!");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Lỗi cập nhật");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-card border border-border rounded-xl" />
        <div className="h-64 bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-4">❌</p>
        <h2 className="text-lg font-bold mb-2">Không tìm thấy workflow</h2>
        <button onClick={() => router.push("/workflows")} className="text-base text-primary hover:underline">← Quay lại</button>
      </div>
    );
  }

  const steps = [...(workflow.steps || [])].sort((a: any, b: any) => a.step_order - b.step_order);
  const transitions = workflow.transitions || [];
  const autoSteps = steps.filter((s: any) => s.is_automatic).length;
  const scopeLabels: Record<string, string> = { global: "Toàn bộ", department: "Phòng ban", project: "Dự án", task_type: "Loại task" };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Back */}
      <button onClick={() => router.push("/workflows")} className="text-sm text-muted-foreground hover:text-primary">
        ← Workflow & Phê duyệt
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold">⚡ {workflow.name}</h1>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                workflow.is_active ? "bg-green-500/10 text-green-500" : "bg-secondary text-muted-foreground"
              }`}>
                {workflow.is_active ? "Đang bật" : "Đã tắt"}
              </span>
              <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {scopeLabels[workflow.scope] || workflow.scope}
              </span>
              {workflow.is_default && (
                <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded font-medium">Mặc định</span>
              )}
            </div>
            {workflow.description && (
              <p className="text-base text-muted-foreground mt-1">{workflow.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" onClick={startEdit}>Sửa</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteWorkflow.isPending}>
              {deleteWorkflow.isPending ? "..." : "Xóa"}
            </Button>
            <Toggle
              checked={workflow.is_active}
              onChange={(v) => toggleWorkflow.mutate({ id: workflow.id, is_active: v })}
            />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setEditing(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">Sửa workflow</h3>
              <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground font-medium">Tên workflow *</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Phạm vi</label>
                  <SearchSelect
                    value={editForm.scope}
                    onChange={(val) => setEditForm({ ...editForm, scope: val })}
                    options={[
                      { value: "global", label: "Toàn bộ" },
                      { value: "department", label: "Phòng ban" },
                      { value: "project", label: "Dự án" },
                      { value: "task_type", label: "Loại task" },
                    ]}
                    placeholder="Chọn phạm vi"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  <label className="text-sm text-muted-foreground font-medium">Mặc định:</label>
                  <Toggle checked={editForm.is_default} onChange={(v) => setEditForm({ ...editForm, is_default: v })} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setEditing(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleSaveEdit} disabled={updateWorkflow.isPending}>
                {updateWorkflow.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tổng bước" value={steps.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Tự động" value={autoSteps} accentColor="#8b5cf6" />
        <StatCard label="Thủ công" value={steps.length - autoSteps} accentColor="#3b82f6" />
        <StatCard label="Transitions" value={transitions.length} accentColor="#10b981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Steps Detail */}
        <div className="lg:col-span-2">
          <Section title={`Các bước (${steps.length})`}>
            <div className="p-4 space-y-0">
              {steps.map((step: any, idx: number) => {
                const cfg = STEP_TYPE_CONFIG[step.step_type] || STEP_TYPE_CONFIG.custom;
                const roleCfg = step.assigned_role ? ROLE_LABELS[step.assigned_role] : null;
                return (
                  <div key={step.id} className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base border-2"
                        style={{ borderColor: cfg.color, background: `${cfg.color}15` }}
                      >
                        {cfg.icon}
                      </div>
                      {idx < steps.length - 1 && (
                        <div className="flex-1 w-0.5 my-1" style={{ background: `${cfg.color}40` }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-muted-foreground">#{step.step_order}</span>
                        <h4 className="text-base font-bold">{step.name}</h4>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span
                          className="px-2 py-0.5 rounded font-medium"
                          style={{ background: `${cfg.color}15`, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                        {roleCfg && (
                          <span
                            className="px-2 py-0.5 rounded font-medium"
                            style={{ background: `${roleCfg.color}15`, color: roleCfg.color }}
                          >
                            {roleCfg.label}
                          </span>
                        )}
                        {!step.assigned_role && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                            Hệ thống
                          </span>
                        )}
                        {step.is_automatic && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                            Tự động
                          </span>
                        )}
                        {step.sla_hours && (
                          <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                            SLA: {step.sla_hours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Flow Preview */}
          <Section title="Luồng tổng quan">
            <div className="p-4 space-y-2">
              {steps.map((step: any, idx: number) => {
                const cfg = STEP_TYPE_CONFIG[step.step_type] || STEP_TYPE_CONFIG.custom;
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    {idx > 0 && <div className="w-4 text-center text-muted-foreground text-sm">↓</div>}
                    {idx === 0 && <div className="w-4" />}
                    <div
                      className="flex items-center gap-1.5 flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: `${cfg.color}10`, color: cfg.color }}
                    >
                      <span className="text-sm">{cfg.icon}</span>
                      <span className="truncate">{step.name}</span>
                      {step.is_automatic && <span className="ml-auto text-[8px] opacity-60">auto</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Transitions */}
          {transitions.length > 0 && (
            <Section title={`Transitions (${transitions.length})`}>
              <div className="p-4 space-y-2">
                {transitions.map((t: any) => {
                  const fromStep = steps.find((s: any) => s.id === t.from_step_id);
                  const toStep = steps.find((s: any) => s.id === t.to_step_id);
                  return (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span className="bg-secondary px-2 py-0.5 rounded truncate max-w-[80px]">
                        {fromStep?.name || "?"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="bg-secondary px-2 py-0.5 rounded truncate max-w-[80px]">
                        {toStep?.name || "?"}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">{t.condition_type}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Info */}
          <Section title="Thông tin">
            <div className="p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phạm vi</span>
                <span className="font-medium">{scopeLabels[workflow.scope] || workflow.scope}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mặc định</span>
                <span>{workflow.is_default ? "Có" : "Không"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className={workflow.is_active ? "text-green-500 font-medium" : "text-muted-foreground"}>
                  {workflow.is_active ? "Đang bật" : "Đã tắt"}
                </span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
