"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCreateGoal } from "@/features/goals";
import { useAuthStore } from "@/lib/stores";
import { getAllowedGoalTypes } from "@/lib/utils/permissions";
import { Button } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { GoalType, UserRole } from "@/lib/types";

const supabase = createClient();

const GOAL_TYPES: { value: GoalType; label: string; icon: string }[] = [
  { value: "company", label: "Công ty", icon: "🏢" },
  { value: "department", label: "Phòng ban", icon: "🏛️" },
  { value: "team", label: "Nhóm", icon: "👥" },
  { value: "personal", label: "Cá nhân", icon: "👤" },
];

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4"];

interface TargetInput {
  title: string;
  target_type: string;
  start_value: number;
  target_value: number;
  unit: string;
}

export default function NewGoalPage() {
  const router = useRouter();
  const createGoal = useCreateGoal();
  const { user } = useAuthStore();

  // Fetch all goals for parent selection (lightweight query)
  const { data: allGoals = [] } = useQuery({
    queryKey: ["goals", "all-for-parent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, title, goal_type")
        .neq("status", "cancelled")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const allowedTypes = getAllowedGoalTypes((user?.role as UserRole) || "staff");
  const visibleGoalTypes = GOAL_TYPES.filter((t) => allowedTypes.includes(t.value));

  const [form, setForm] = useState({
    title: "",
    description: "",
    goal_type: (allowedTypes[0] || "personal") as GoalType,
    parent_goal_id: "",
    period_label: "",
    start_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    color: "#3b82f6",
    is_public: true,
  });

  const [targets, setTargets] = useState<TargetInput[]>([
    { title: "", target_type: "number", start_value: 0, target_value: 100, unit: "" },
  ]);

  // Mỗi loại goal có thể chọn cha thuộc các loại cấp trên
  const PARENT_TYPES: Record<GoalType, GoalType[]> = {
    company: [],
    center: ["company"],
    department: ["company", "center"],
    team: ["department", "center"],
    personal: ["team", "department"],
  };

  const parentGoals = useMemo(() => {
    const allowedParents = PARENT_TYPES[form.goal_type] || [];
    if (allowedParents.length === 0) return [];
    return allGoals.filter((g: any) => allowedParents.includes(g.goal_type));
  }, [allGoals, form.goal_type]);

  const update = (key: string, val: any) => {
    if (key === "goal_type") {
      // Reset parent when goal type changes
      setForm((prev) => ({ ...prev, goal_type: val, parent_goal_id: "" }));
    } else {
      setForm((prev) => ({ ...prev, [key]: val }));
    }
  };

  const updateTarget = (idx: number, key: string, val: any) => {
    setTargets((prev) => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));
  };

  const addTarget = () => {
    setTargets((prev) => [...prev, { title: "", target_type: "number", start_value: 0, target_value: 100, unit: "" }]);
  };

  const removeTarget = (idx: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Vui lòng nhập tên mục tiêu"); return; }
    try {
      const newGoal = await createGoal.mutateAsync({
        ...form,
        parent_goal_id: form.parent_goal_id || null,
        progress_source: "manual",
      });

      // Insert Key Results into goal_targets
      const validTargets = targets.filter((t) => t.title.trim());
      if (validTargets.length > 0 && newGoal?.id) {
        const rows = validTargets.map((t, idx) => ({
          goal_id: newGoal.id,
          title: t.title,
          target_type: (t.target_type || "number") as "number" | "boolean" | "currency" | "percentage" | "task_completion",
          start_value: t.start_value,
          current_value: t.start_value,
          target_value: t.target_value,
          unit: t.unit || null,
          sort_order: idx,
        }));
        const { error: targetError } = await supabase.from("goal_targets").insert(rows);
        if (targetError) {
          toast.error("Tạo goal thành công nhưng lỗi thêm KR: " + targetError.message);
        }
      }

      toast.success("Tạo mục tiêu thành công!");
      router.push("/goals");
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo mục tiêu");
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-primary mb-2">
          ← Quay lại
        </button>
        <h1 className="text-xl font-bold">Tạo mục tiêu mới</h1>
        <p className="text-base text-muted-foreground mt-0.5">Thiết lập OKR với key results cụ thể</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Goal Type */}
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-2 block">Cấp mục tiêu</label>
            <div className="flex gap-2">
              {visibleGoalTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => update("goal_type", t.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-base font-medium transition-all ${
                    form.goal_type === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">Tên mục tiêu *</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="VD: Tăng năng suất phòng thiết kế 20% Q2/2026"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-secondary text-base font-medium focus:border-primary focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                placeholder="Mục đích, scope, đối tượng..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Kỳ</label>
              <input
                value={form.period_label}
                onChange={(e) => update("period_label", e.target.value)}
                placeholder="VD: Q2/2026"
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
            {form.goal_type !== "company" && (
              <div>
                <label className="text-sm text-muted-foreground font-medium">
                  Mục tiêu cha
                  <span className="text-muted-foreground/60 ml-1">
                    ({form.goal_type === "department" ? "Công ty" : form.goal_type === "team" ? "Phòng ban" : "Nhóm"})
                  </span>
                </label>
                <SearchSelect
                  value={form.parent_goal_id}
                  onChange={(val) => update("parent_goal_id", val)}
                  options={parentGoals.map((g: any) => ({ value: g.id, label: g.title }))}
                  placeholder="— Chọn mục tiêu cha —"
                  className="mt-1"
                />
                {parentGoals.length === 0 && (
                  <p className="text-[11px] text-amber-500 mt-1">
                    Chưa có mục tiêu cấp {form.goal_type === "department" ? "Công ty" : form.goal_type === "team" ? "Phòng ban" : "Nhóm"} nào
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground font-medium">Bắt đầu</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Deadline</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => update("due_date", e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-2 block">Màu</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update("color", c)}
                  className={`w-7 h-8 rounded-full border-2 transition-all ${
                    form.color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Key Results */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-base font-bold">Key Results</label>
              <Button size="xs" onClick={addTarget}>+ Thêm KR</Button>
            </div>
            <div className="space-y-3">
              {targets.map((target, idx) => (
                <div key={idx} className="bg-secondary/50 rounded-xl p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      value={target.title}
                      onChange={(e) => updateTarget(idx, "title", e.target.value)}
                      placeholder="VD: Hoàn thành 50 sản phẩm đúng hạn"
                      className="flex-1 h-10 px-2 rounded-md border border-border bg-card text-base focus:border-primary focus:outline-none"
                    />
                    {targets.length > 1 && (
                      <button
                        onClick={() => removeTarget(idx)}
                        className="text-muted-foreground hover:text-destructive text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pl-8">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-muted-foreground">Bắt đầu</label>
                      <input
                        type="number"
                        value={target.start_value}
                        onChange={(e) => updateTarget(idx, "start_value", +e.target.value)}
                        className="w-16 h-8 px-2 rounded border border-border bg-card text-sm font-mono text-center focus:border-primary focus:outline-none"
                      />
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-muted-foreground">Mục tiêu</label>
                      <input
                        type="number"
                        value={target.target_value}
                        onChange={(e) => updateTarget(idx, "target_value", +e.target.value)}
                        className="w-16 h-8 px-2 rounded border border-border bg-card text-sm font-mono text-center focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-muted-foreground">Đơn vị</label>
                      <input
                        value={target.unit}
                        onChange={(e) => updateTarget(idx, "unit", e.target.value)}
                        placeholder="SP, %, h"
                        className="w-16 h-8 px-2 rounded border border-border bg-card text-sm text-center focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-secondary/30">
          <Button onClick={() => router.back()}>Hủy</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={createGoal.isPending || !form.title.trim()}
          >
            {createGoal.isPending ? "Đang tạo..." : "Tạo mục tiêu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
