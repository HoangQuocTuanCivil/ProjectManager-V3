"use client";

import { useState } from "react";
import { useCreateWorkflow } from "@/lib/hooks/use-workflows";
import { Button, Toggle } from "@/components/shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { SearchSelect } from "@/shared/ui/search-select";
import type { WorkflowStepType, UserRole, WorkflowStep } from "@/lib/types";

const STEP_TYPES: { id: WorkflowStepType; label: string; icon: string; color: string }[] = [
  { id: "create", label: "Tạo", icon: "✏️", color: "#38bdf8" },
  { id: "execute", label: "Thực hiện", icon: "⚡", color: "#10b981" },
  { id: "submit", label: "Nộp", icon: "📤", color: "#8b5cf6" },
  { id: "review", label: "Kiểm tra", icon: "🔍", color: "#f59e0b" },
  { id: "approve", label: "Duyệt", icon: "✅", color: "#10b981" },
  { id: "calculate", label: "Tính toán", icon: "🔢", color: "#6366f1" },
  { id: "notify", label: "Thông báo", icon: "🔔", color: "#ec4899" },
  { id: "archive", label: "Lưu trữ", icon: "📦", color: "#64748b" },
];

const ROLES: { id: UserRole | "system"; label: string; color: string }[] = [
  { id: "staff", label: "Nhân viên", color: "#10b981" },
  { id: "head", label: "Trưởng phòng", color: "#3b82f6" },
  { id: "leader", label: "Lãnh đạo", color: "#f59e0b" },
  { id: "system", label: "Hệ thống", color: "#8b5cf6" },
];

interface StepDraft {
  name: string;
  step_type: WorkflowStepType;
  assigned_role: UserRole | "system" | null;
  is_automatic: boolean;
  sla_hours: number | null;
}

export function WorkflowBuilder({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  const createWorkflow = useCreateWorkflow();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"global" | "department">("global");
  const [steps, setSteps] = useState<StepDraft[]>([
    { name: "Tạo công việc", step_type: "create", assigned_role: "head", is_automatic: false, sla_hours: null },
  ]);

  const addStep = (type: WorkflowStepType) => {
    const cfg = STEP_TYPES.find((s) => s.id === type);
    setSteps([...steps, {
      name: cfg?.label ?? type,
      step_type: type,
      assigned_role: type === "calculate" || type === "archive" ? "system" : "staff",
      is_automatic: type === "calculate" || type === "archive" || type === "notify",
      sla_hours: null,
    }]);
  };

  const updateStep = (idx: number, updates: Partial<StepDraft>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const copy = [...steps];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setSteps(copy);
  };

  const handleSave = async () => {
    if (!name.trim() || steps.length < 2) return;
    try {
      await createWorkflow.mutateAsync({
        name,
        description,
        scope,
        is_active: true,
        steps: steps.map((s) => ({
          name: s.name,
          step_type: s.step_type,
          assigned_role: s.assigned_role === "system" ? null : s.assigned_role,
          is_automatic: s.is_automatic,
          sla_hours: s.sla_hours,
        })),
      } as any);
      toast.success("Tạo quy trình thành công!");
      onSave?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo quy trình");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold">⚡ Tạo quy trình workflow mới</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">Tên quy trình *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Giao việc BIM tiêu chuẩn"
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-secondary text-base font-medium focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Phạm vi</label>
              <SearchSelect
                value={scope}
                onChange={(val) => setScope(val as any)}
                options={[
                  { value: "global", label: "Toàn bộ" },
                  { value: "department", label: "Theo phòng ban" },
                  { value: "project", label: "Theo dự án" },
                ]}
                placeholder="Chọn phạm vi"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn..."
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
          </div>

          {/* Steps Designer */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Các bước ({steps.length})</h3>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => {
                const typeCfg = STEP_TYPES.find((t) => t.id === step.step_type);
                const roleCfg = ROLES.find((r) => r.id === step.assigned_role);

                return (
                  <div key={idx} className="flex items-stretch gap-2">
                    {/* Step Number + Arrow */}
                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                      <div className="w-7 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ background: typeCfg?.color ?? "#64748b" }}>
                        {idx + 1}
                      </div>
                      {idx < steps.length - 1 && <div className="flex-1 w-px bg-border my-1" />}
                    </div>

                    {/* Step Card */}
                    <div className="flex-1 bg-secondary border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{typeCfg?.icon}</span>
                        <input
                          value={step.name}
                          onChange={(e) => updateStep(idx, { name: e.target.value })}
                          className="flex-1 bg-transparent text-base font-semibold focus:outline-none border-b border-transparent focus:border-primary"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Di chuyển lên">▲</button>
                          <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Di chuyển xuống">▼</button>
                          <button onClick={() => removeStep(idx)} disabled={steps.length <= 1} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-20 ml-1" aria-label="Xóa bước">✕</button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        {/* Step Type */}
                        <SearchSelect
                          value={step.step_type}
                          onChange={(val) => updateStep(idx, { step_type: val as WorkflowStepType })}
                          options={STEP_TYPES.map((t) => ({ value: t.id, label: `${t.icon} ${t.label}` }))}
                          placeholder="Chọn loại"
                          className="mt-1"
                        />

                        {/* Assigned Role */}
                        <SearchSelect
                          value={step.assigned_role ?? ""}
                          onChange={(val) => updateStep(idx, { assigned_role: val as any })}
                          options={ROLES.map((r) => ({ value: r.id, label: r.label }))}
                          placeholder="Chọn vai trò"
                          className="mt-1"
                        />

                        {/* Auto */}
                        <div className="flex items-center gap-1.5">
                          <Toggle checked={step.is_automatic} onChange={(v) => updateStep(idx, { is_automatic: v })} />
                          <span className="text-muted-foreground">Tự động</span>
                        </div>

                        {/* SLA */}
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">SLA:</span>
                          <input
                            type="number" value={step.sla_hours ?? ""} placeholder="—"
                            onChange={(e) => updateStep(idx, { sla_hours: e.target.value ? +e.target.value : null })}
                            className="w-12 h-8 px-1 rounded border border-border bg-card text-sm font-mono text-center focus:border-primary focus:outline-none"
                          />
                          <span className="text-muted-foreground">giờ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Step */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-sm text-muted-foreground py-1">+ Thêm bước:</span>
              {STEP_TYPES.map((t) => (
                <button key={t.id} onClick={() => addStep(t.id)}
                  className="px-2 py-1 rounded text-[11px] font-medium border border-border hover:border-primary hover:text-primary transition-all"
                  style={{ color: t.color }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-secondary/50 rounded-lg p-3 border border-border">
            <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-2">Xem trước luồng</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {steps.map((s, i) => {
                const typeCfg = STEP_TYPES.find((t) => t.id === s.step_type);
                const roleCfg = ROLES.find((r) => r.id === s.assigned_role);
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-foreground text-base">→</span>}
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-card border border-border text-[11px]">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: typeCfg?.color }}>
                        {i + 1}
                      </span>
                      <span className="font-medium truncate max-w-[100px]">{s.name}</span>
                      <span className="px-1 py-0.5 rounded text-[8px]" style={{ background: `${roleCfg?.color}18`, color: roleCfg?.color }}>{roleCfg?.label}</span>
                      {s.is_automatic && <span className="px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[8px]">auto</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between sticky bottom-0 bg-card">
          <p className="text-sm text-muted-foreground">{steps.length} bước · {steps.filter((s) => s.is_automatic).length} tự động</p>
          <div className="flex gap-3">
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" onClick={handleSave} disabled={createWorkflow.isPending || !name.trim() || steps.length < 2}>
              {createWorkflow.isPending ? "Đang tạo..." : "Tạo quy trình"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
