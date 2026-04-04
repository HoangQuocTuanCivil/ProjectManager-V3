"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores";
import { goalKeys } from "@/lib/hooks/use-goals";
import { Section, ProgressBar, UserAvatar, EmptyState, StatCard, Button } from "@/components/shared";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";
import { SearchSelect } from "@/components/shared/search-select";
import { toast } from "sonner";
import type { Goal, GoalTarget, GoalType, GoalStatus } from "@/lib/types";

const TYPE_CONFIG: Record<GoalType, { label: string; icon: string; color: string }> = {
  company: { label: "Công ty", icon: "🏢", color: "#6366f1" },
  center: { label: "Trung tâm", icon: "🏬", color: "#8b5cf6" },
  department: { label: "Phòng ban", icon: "🏛️", color: "#3b82f6" },
  team: { label: "Nhóm", icon: "👥", color: "#10b981" },
  personal: { label: "Cá nhân", icon: "👤", color: "#f59e0b" },
};

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string }> = {
  on_track: { label: "Đúng tiến độ", color: "#10b981" },
  at_risk: { label: "Có rủi ro", color: "#f59e0b" },
  off_track: { label: "Lệch tiến độ", color: "#ef4444" },
  achieved: { label: "Đã đạt", color: "#6366f1" },
  cancelled: { label: "Đã hủy", color: "#6b7280" },
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;
  const supabase = createClient();

  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canManage = user && ["admin", "leader", "head", "team_leader"].includes(user.role);
  const [editing, setEditing] = useState(false);

  const { data: goal, isLoading } = useQuery({
    queryKey: ["goals", goalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("id", goalId).single();
      if (error) throw error;

      const [ownerRes, targetsRes, subGoalsRes] = await Promise.all([
        data.owner_id ? supabase.from("users").select("id, full_name, avatar_url, role").eq("id", data.owner_id).single() : { data: null },
        supabase.from("goal_targets").select("*").eq("goal_id", goalId),
        supabase.from("goals").select("id, title, progress, status, goal_type").eq("parent_goal_id", goalId).neq("status", "cancelled"),
      ]);

      return {
        ...data,
        owner: ownerRes.data,
        targets: targetsRes.data || [],
        sub_goals: subGoalsRes.data || [],
      } as unknown as Goal & { targets: GoalTarget[]; sub_goals: any[] };
    },
    enabled: !!goalId,
  });

  const updateGoal = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("goals").update(updates).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", goalId] });
      queryClient.invalidateQueries({ queryKey: goalKeys.list() });
      toast.success("Cập nhật thành công!");
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Lỗi cập nhật"),
  });

  const deleteGoal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goals").update({ status: "cancelled" }).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.list() });
      toast.success("Đã xóa mục tiêu");
      router.push("/goals");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-card border border-border rounded-xl" />
        <div className="h-48 bg-card border border-border rounded-xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-4">❌</p>
        <h2 className="text-lg font-bold mb-2">Không tìm thấy mục tiêu</h2>
        <button onClick={() => router.push("/goals")} className="text-base text-primary hover:underline">← Quay lại</button>
      </div>
    );
  }

  const typeCfg = TYPE_CONFIG[goal.goal_type] || TYPE_CONFIG.personal;
  const statusCfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.on_track;
  const targets = goal.targets || [];
  const subGoals = goal.sub_goals || [];
  const targetsDone = targets.filter((t) => t.is_completed).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/goals")} className="text-sm text-muted-foreground hover:text-primary">
          ← Goals & OKR
        </button>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setEditing(!editing)}>{editing ? "Hủy sửa" : "Sửa"}</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm("Xác nhận xóa mục tiêu?")) deleteGoal.mutate(); }}>Xóa</Button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="h-[4px]" style={{ background: goal.color || typeCfg.color }} />
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: `${typeCfg.color}15`, color: typeCfg.color }}>
                  {typeCfg.icon} {typeCfg.label}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: `${statusCfg.color}15`, color: statusCfg.color }}>
                  {statusCfg.label}
                </span>
                {goal.period_label && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{goal.period_label}</span>
                )}
              </div>
              <h1 className="text-lg font-bold">{goal.title}</h1>
              {goal.description && (
                <p className="text-base text-muted-foreground mt-1">{goal.description}</p>
              )}
            </div>
            {goal.owner && (
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <UserAvatar name={goal.owner.full_name} color={ROLE_CONFIG[goal.owner.role as keyof typeof ROLE_CONFIG]?.color} size="md" />
                <div>
                  <p className="text-sm font-semibold">{goal.owner.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">Owner</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDate(goal.start_date)} → {formatDate(goal.due_date)}</span>
            <span>{targetsDone}/{targets.length} key results</span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">Tiến độ tổng</span>
              <span className="font-mono text-base font-bold">{goal.progress}%</span>
            </div>
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${goal.progress}%`, background: goal.color || typeCfg.color }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <GoalEditForm goal={goal} onSave={(u) => updateGoal.mutate(u)} isPending={updateGoal.isPending} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tiến độ" value={`${goal.progress}%`} accentColor={goal.color || typeCfg.color} />
        <StatCard label="Key Results" value={`${targetsDone}/${targets.length}`} accentColor="#10b981" />
        <StatCard label="Sub-goals" value={subGoals.length} accentColor="#3b82f6" />
        <StatCard label="Trạng thái" value={statusCfg.label} accentColor={statusCfg.color} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Key Results */}
        <div className="lg:col-span-2">
          <Section title={`Key Results (${targets.length})`}>
            {targets.length === 0 ? (
              <div className="p-6">
                <EmptyState icon="🎯" title="Chưa có key result" subtitle="Thêm KR để đo lường mục tiêu" />
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {targets.map((target, idx) => {
                  const range = target.target_value - target.start_value;
                  const pct = range > 0 ? Math.round(((target.current_value - target.start_value) / range) * 100) : 0;
                  const clampedPct = Math.min(Math.max(pct, 0), 100);
                  return (
                    <div key={target.id} className="px-4 py-3.5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-base ${target.is_completed ? "text-green-500" : "text-muted-foreground"}`}>
                          {target.is_completed ? "✓" : `${idx + 1}.`}
                        </span>
                        <span className={`text-sm font-medium flex-1 ${target.is_completed ? "line-through text-muted-foreground" : ""}`}>
                          {target.title}
                        </span>
                        <span className="font-mono text-sm font-bold" style={{ color: clampedPct >= 100 ? "#10b981" : clampedPct >= 60 ? "hsl(var(--primary))" : "#f59e0b" }}>
                          {clampedPct}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 ml-7">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${clampedPct}%`,
                              background: clampedPct >= 100 ? "#10b981" : goal.color || typeCfg.color,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-28 text-right">
                          {target.current_value} / {target.target_value} {target.unit || ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Sub-goals */}
          {subGoals.length > 0 && (
            <Section title={`Sub-goals (${subGoals.length})`}>
              <div className="p-3 space-y-2">
                {subGoals.map((sg: any) => {
                  const sgTypeCfg = TYPE_CONFIG[sg.goal_type as GoalType] || TYPE_CONFIG.personal;
                  const sgStatusCfg = STATUS_CONFIG[sg.status as GoalStatus] || STATUS_CONFIG.on_track;
                  return (
                    <div
                      key={sg.id}
                      onClick={() => router.push(`/goals/${sg.id}`)}
                      className="p-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px]">{sgTypeCfg.icon}</span>
                        <span className="text-sm font-semibold flex-1 truncate">{sg.title}</span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: `${sgStatusCfg.color}15`, color: sgStatusCfg.color }}
                        >
                          {sgStatusCfg.label}
                        </span>
                      </div>
                      <ProgressBar value={sg.progress} className="ml-5" />
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
                <span className="text-muted-foreground">Loại</span>
                <span className="font-medium">{typeCfg.icon} {typeCfg.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kỳ</span>
                <span className="font-medium">{goal.period_label || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bắt đầu</span>
                <span className="font-mono">{formatDate(goal.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deadline</span>
                <span className="font-mono">{formatDate(goal.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Công khai</span>
                <span>{goal.is_public ? "Có" : "Không"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nguồn tiến độ</span>
                <span>{goal.progress_source}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function GoalEditForm({ goal, onSave, isPending }: { goal: any; onSave: (u: any) => void; isPending: boolean }) {
  const [form, setForm] = useState({
    title: goal.title,
    description: goal.description || "",
    status: goal.status,
    progress: goal.progress,
    due_date: goal.due_date?.slice(0, 10) || "",
  });
  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-3">
      <h3 className="text-base font-bold text-primary">Chỉnh sửa mục tiêu</h3>
      <div>
        <label className={labelClass}>Tên mục tiêu</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Mô tả</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass + " h-auto py-2"} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Trạng thái</label>
          <SearchSelect
            value={form.status}
            onChange={(val) => setForm({ ...form, status: val })}
            options={[
              { value: "on_track", label: "Đúng tiến độ" },
              { value: "at_risk", label: "Có rủi ro" },
              { value: "off_track", label: "Lệch tiến độ" },
              { value: "achieved", label: "Đã đạt" },
            ]}
            placeholder="Chọn trạng thái"
            className="mt-1"
          />
        </div>
        <div>
          <label className={labelClass}>Tiến độ (%)</label>
          <input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Deadline</label>
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="primary" onClick={() => onSave(form)} disabled={isPending}>
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </div>
  );
}
