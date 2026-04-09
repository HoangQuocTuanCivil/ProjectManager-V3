"use client";

import { useState } from "react";
import { useTask, useUpdateTask, useUpdateProgress, useEvaluateKPI } from "@/lib/hooks/use-tasks";
import { useAdvanceWorkflow } from "@/lib/hooks/use-workflows";
import { StatusBadge, PriorityBadge, ProgressBar, UserAvatar, KPIRing, KPIScoreBar, VerdictBadge, Button, Tag, Section } from "@/components/shared";
import { ROLE_CONFIG, STATUS_CONFIG, formatDate, getVerdict, VERDICT_CONFIG, calcKPIScore } from "@/lib/utils/kpi";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TaskMessenger } from "./task-messenger";
import { TaskAttachments } from "./task-attachments";
import { SearchSelect } from "@/components/shared/search-select";

export function TaskDetail({ taskId, onClose, zIndex, transparentOverlay }: {
  taskId: string; onClose: () => void; zIndex?: number;
  /** Overlay trong suốt: dùng khi TaskDetail mở đè lên dialog khác, giữ dialog phía sau có thể nhìn thấy */
  transparentOverlay?: boolean;
}) {
  const { data: task, isLoading, error } = useTask(taskId);
  const { user } = useAuthStore();
  const updateProgress = useUpdateProgress();
  const updateTask = useUpdateTask();
  const evaluateKPI = useEvaluateKPI();
  const advanceWorkflow = useAdvanceWorkflow();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [evalVolume, setEvalVolume] = useState(task?.actual_volume ?? 100);
  const [evalAhead, setEvalAhead] = useState(task?.actual_ahead ?? 50);
  const [evalQuality, setEvalQuality] = useState(80);
  const [evalDifficulty, setEvalDifficulty] = useState(70);
  const [evalNote, setEvalNote] = useState("");
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const overlayZ = zIndex ?? 50;
  /* Overlay (overlayZ) bắt click vùng trống để đóng panel.
     Panel (overlayZ + 1) luôn nằm trên overlay, nhận mọi pointer event. */
  const panelZ = overlayZ + 1;

  const handleProgressSubmit = () => {
    const val = localProgress ?? task?.progress ?? 0;
    updateProgress.mutate(
      { id: taskId, progress: val },
      {
        onSuccess: () => {
          setLocalProgress(null);
          toast.success(`Cập nhật tiến độ: ${val}%`);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Lỗi cập nhật tiến độ. Vui lòng thử lại.");
        },
      }
    );
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").update({ status: "cancelled" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Đã xóa công việc");
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Lỗi xóa"),
  });

  // Check if current user is a team leader for this task's team
  // IMPORTANT: This hook MUST be called before the early return to respect Rules of Hooks
  const { data: isTaskTeamLeader } = useQuery({
    queryKey: ["is-team-leader", user?.id, task?.team_id],
    queryFn: async () => {
      if (!user || !task?.team_id) return false;
      const { data } = await supabase.from("teams").select("id").eq("id", task.team_id).eq("leader_id", user.id).maybeSingle();
      return !!data;
    },
    enabled: !!user && !!task?.team_id && (user.role === "staff" || user.role === "team_leader"),
  });

  if (error || (!isLoading && !task)) {
    return (
      <>
        <div className="fixed inset-0" style={{ zIndex: overlayZ, background: transparentOverlay ? "transparent" : "rgba(0,0,0,0.5)" }} onClick={onClose} />
        <div className="fixed top-0 right-0 h-full w-[680px] bg-card border-l border-border flex flex-col items-center justify-center gap-3" style={{ zIndex: panelZ }}>
          <p className="text-4xl">😔</p>
          <p className="text-base font-semibold">Không thể tải công việc</p>
          <p className="text-sm text-muted-foreground text-center px-8">Công việc không tồn tại hoặc bạn không có quyền xem.</p>
          <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all">
            ← Quay lại
          </button>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="fixed inset-0" style={{ zIndex: overlayZ, background: transparentOverlay ? "transparent" : "rgba(0,0,0,0.5)" }} />
        <div className="fixed top-0 right-0 h-full w-[680px] bg-card border-l border-border flex items-center justify-center" style={{ zIndex: panelZ }}>
          <p className="text-muted-foreground text-base">Đang tải...</p>
        </div>
      </>
    );
  }

  if (!task) return null;

  const isAssignee = user && task.assignee_id === user.id;
  const canManage = user && (["admin", "leader", "head", "team_leader"].includes(user.role) || isTaskTeamLeader || isAssignee);
  const canUpdateProgress = user && (user.role === "admin" || isAssignee);
  const canEvaluate = canManage && !task.kpi_evaluated_at && task.status === "review";
  const verdict = getVerdict(task.kpi_variance);
  const verdictCfg = VERDICT_CONFIG[verdict];

  const handleEvaluate = async () => {
    await evaluateKPI.mutateAsync({
      task_id: taskId,
      actual_volume: evalVolume,
      actual_ahead: evalAhead,
      actual_quality: evalQuality,
      actual_difficulty: evalDifficulty,
      note: evalNote || undefined,
    });
    setShowEvalForm(false);
  };

  return (
    <>
    <div className="fixed inset-0" style={{ zIndex: overlayZ, background: transparentOverlay ? "transparent" : "rgba(0,0,0,0.5)" }} onClick={onClose} />
    <div className="fixed top-0 right-0 h-full w-[680px] bg-card border-l border-border overflow-y-auto" style={{ zIndex: panelZ }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <span className="font-mono text-sm text-muted-foreground">W:{task.kpi_weight}</span>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button onClick={() => setShowEditForm(true)} className="text-sm text-primary hover:underline">Sửa</button>
                <button onClick={() => setConfirmDelete(true)} className="text-sm text-destructive hover:underline">Xóa</button>
              </>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg ml-2 p-1 rounded focus-ring" aria-label="Đóng">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Title + Project */}
          <div>
            <h2 className="text-lg font-bold leading-tight">{task.title}</h2>
            {task.project && (
              <p className="text-sm font-mono text-primary mt-1">{task.project.code} — {task.project.name}</p>
            )}
            {task.description && <p className="text-base text-muted-foreground mt-2 leading-relaxed">{task.description}</p>}
          </div>

          {/* People + Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1.5">Giao cho</p>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <UserAvatar name={task.assignee.full_name} color={ROLE_CONFIG[task.assignee.role]?.color} size="sm" />
                  <div>
                    <p className="text-sm font-semibold">{task.assignee.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{ROLE_CONFIG[task.assignee.role]?.label}</p>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Chưa giao</p>}
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1.5">Thời gian</p>
              <p className="text-sm">{formatDate(task.start_date)} → {formatDate(task.deadline)}</p>
              {task.estimate_hours && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Dự kiến: {task.estimate_hours}h {task.actual_hours ? `| Thực tế: ${task.actual_hours}h` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-secondary rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold">Tiến độ</p>
              <span className="font-mono text-base font-bold">{localProgress ?? task.progress}%</span>
            </div>
            <div className="w-full h-2 bg-card rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${localProgress ?? task.progress}%`, background: (localProgress ?? task.progress) >= 80 ? "#10b981" : (localProgress ?? task.progress) >= 40 ? "#38bdf8" : "#f59e0b" }}
              />
            </div>
            {canUpdateProgress && task.status !== "completed" && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="range" min="0" max="100" step="5" 
                  value={localProgress ?? task.progress}
                  onChange={(e) => setLocalProgress(+e.target.value)}
                  className="flex-1 accent-primary"
                />
                <Button size="xs" variant="primary" onClick={handleProgressSubmit} disabled={updateProgress.isPending}>
                  {updateProgress.isPending ? "..." : "Cập nhật"}
                </Button>
              </div>
            )}
          </div>

          {/* KPI E vs A Comparison */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-secondary/50 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">KPI: kỳ vọng vs thực tế</h3>
              <VerdictBadge verdict={verdict} />
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {/* Expected */}
              <div>
                <p className="text-[11px] text-primary font-semibold uppercase mb-2">Kỳ vọng (E)</p>
                <div className="flex items-center gap-3 mb-3">
                  <KPIRing score={task.expect_score} size={52} strokeWidth={4} />
                  <span className="font-mono text-lg font-bold text-primary">{Math.round(task.expect_score)}</span>
                </div>
                <div className="space-y-1.5">
                  <KPIScoreBar label="Khối lượng" value={task.expect_volume} color="#38bdf8" weight="40%" />
                  <KPIScoreBar label="Chất lượng" value={task.expect_quality} color="#10b981" weight="30%" />
                  <KPIScoreBar label="Độ khó" value={task.expect_difficulty} color="#f59e0b" weight="20%" />
                  <KPIScoreBar label="Vượt TĐ" value={task.expect_ahead} color="#8b5cf6" weight="10%" />
                </div>
              </div>

              {/* Actual */}
              <div>
                <p className="text-[11px] font-semibold uppercase mb-2" style={{ color: verdictCfg.color }}>Thực tế (A)</p>
                {task.kpi_evaluated_at ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <KPIRing score={task.actual_score} size={52} strokeWidth={4} />
                      <div>
                        <span className="font-mono text-lg font-bold" style={{ color: verdictCfg.color }}>
                          {Math.round(task.actual_score)}
                        </span>
                        <span className="text-sm font-mono ml-1" style={{ color: (task.kpi_variance ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
                          ({(task.kpi_variance ?? 0) >= 0 ? "+" : ""}{Math.round(task.kpi_variance ?? 0)})
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <KPIScoreBar label="Khối lượng" value={task.actual_volume} color="#38bdf8" weight="40%" />
                      <KPIScoreBar label="Chất lượng" value={task.actual_quality} color="#10b981" weight="30%" />
                      <KPIScoreBar label="Độ khó" value={task.actual_difficulty} color="#f59e0b" weight="20%" />
                      <KPIScoreBar label="Vượt TĐ" value={task.actual_ahead} color="#8b5cf6" weight="10%" />
                    </div>
                    {task.kpi_note && (
                      <p className="text-xs text-muted-foreground mt-2 italic">"{task.kpi_note}"</p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Chưa đánh giá</p>
                    {canEvaluate && (
                      <Button size="sm" variant="primary" onClick={() => setShowEvalForm(true)}>
                        Nghiệm thu + Chấm KPI
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Evaluate Form */}
          {showEvalForm && (
            <div className="border-2 border-orange-500/30 rounded-xl p-4 bg-orange-500/5 space-y-3">
              <h3 className="text-base font-bold text-orange-400">Nghiệm thu — Chấm KPI thực tế</h3>
              <p className="text-xs text-muted-foreground">Điều chỉnh cả 4 chỉ số KPI: Khối lượng, Chất lượng, Độ khó, Vượt tiến độ.</p>

              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-28">Khối lượng (A)</label>
                <input type="range" min="0" max="100" step="5" value={evalVolume} onChange={(e) => setEvalVolume(+e.target.value)} className="flex-1 accent-sky-400" />
                <span className="font-mono text-sm text-sky-400 w-7 text-right">{evalVolume}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-28">Chất lượng (A)</label>
                <input type="range" min="0" max="100" step="5" value={evalQuality} onChange={(e) => setEvalQuality(+e.target.value)} className="flex-1 accent-green-400" />
                <span className="font-mono text-sm text-green-400 w-7 text-right">{evalQuality}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-28">Độ khó (A)</label>
                <input type="range" min="0" max="100" step="5" value={evalDifficulty} onChange={(e) => setEvalDifficulty(+e.target.value)} className="flex-1 accent-amber-400" />
                <span className="font-mono text-sm text-amber-400 w-7 text-right">{evalDifficulty}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-28">Vượt T.Đ (A)</label>
                <input type="range" min="0" max="100" step="5" value={evalAhead} onChange={(e) => setEvalAhead(+e.target.value)} className="flex-1 accent-purple-400" />
                <span className="font-mono text-sm text-purple-400 w-7 text-right">{evalAhead}</span>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Ghi chú</label>
                <textarea value={evalNote} onChange={(e) => setEvalNote(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-secondary text-sm focus:border-primary focus:outline-none resize-none" placeholder="Nhận xét chất lượng sản phẩm..." />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-orange-500/20">
                <div className="text-sm">
                  <span className="text-muted-foreground">Điểm A dự kiến: </span>
                  <span className="font-mono font-bold text-orange-400">{calcKPIScore(evalVolume, evalQuality, evalDifficulty, evalAhead)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setShowEvalForm(false)}>Hủy</Button>
                  <Button size="sm" variant="primary" onClick={handleEvaluate} disabled={evaluateKPI.isPending}>
                    {evaluateKPI.isPending ? "..." : "Xác nhận nghiệm thu"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Workflow State */}
          {task.workflow_state && (
            <Section title="⚡ Workflow">
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm">Đang ở bước: <span className="font-semibold text-primary">{task.workflow_state.current_step?.name}</span></p>
                </div>
                {canManage && task.workflow_state.current_step && (() => {
                  const stepType = task.workflow_state.current_step.step_type;
                  if (stepType === "review") {
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-muted-foreground">Kiểm tra kết quả công việc:</p>
                        <div className="flex gap-2">
                          <Button size="xs" variant="primary" onClick={() => advanceWorkflow.mutate({ taskId, result: "approved", note: "Đạt yêu cầu" })} disabled={advanceWorkflow.isPending}>
                            ✓ Đạt
                          </Button>
                          <Button size="xs" variant="destructive" onClick={() => {
                            if (confirm("Yêu cầu sửa lại? Task sẽ quay về bước Thực hiện.")) {
                              advanceWorkflow.mutate({ taskId, result: "rejected", note: "Không đạt, yêu cầu sửa lại" });
                              // Reset task status to in_progress for revision
                              supabase.from("tasks").update({ status: "in_progress", progress: 80 }).eq("id", taskId);
                            }
                          }} disabled={advanceWorkflow.isPending}>
                            ✗ Không đạt
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  if (stepType === "approve") {
                    return (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-muted-foreground">Phê duyệt cuối cùng:</p>
                        <div className="flex gap-2">
                          <Button size="xs" variant="primary" onClick={() => {
                            advanceWorkflow.mutate({ taskId, result: "approved", note: "Đã phê duyệt" });
                            supabase.from("tasks").update({ status: "completed", progress: 100 }).eq("id", taskId);
                          }} disabled={advanceWorkflow.isPending}>
                            ✓ Phê duyệt
                          </Button>
                          <Button size="xs" variant="destructive" onClick={() => {
                            if (confirm("Từ chối? Task sẽ quay về kiểm tra lại.")) {
                              advanceWorkflow.mutate({ taskId, result: "rejected", note: "Từ chối phê duyệt" });
                            }
                          }} disabled={advanceWorkflow.isPending}>
                            ✗ Từ chối
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  if (stepType === "execute") {
                    return (
                      <p className="text-[11px] text-muted-foreground pt-1">Nhân viên đang thực hiện. Khi tiến độ đạt 100% sẽ tự động chuyển bước tiếp theo.</p>
                    );
                  }
                  return (
                    <div className="flex gap-2 pt-1">
                      <Button size="xs" variant="primary" onClick={() => advanceWorkflow.mutate({ taskId, result: "approved" })} disabled={advanceWorkflow.isPending}>
                        Chuyển bước tiếp
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </Section>
          )}

          {/* Delete Confirmation */}
          {confirmDelete && (
            <div className="border-2 border-destructive/30 rounded-xl p-4 bg-destructive/5 space-y-3">
              <p className="text-base font-bold text-destructive">Xác nhận xóa công việc?</p>
              <p className="text-sm text-muted-foreground">Công việc sẽ bị hủy (cancelled). Thao tác này không thể hoàn tác.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setConfirmDelete(false)}>Hủy</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? "Đang xóa..." : "Xác nhận xóa"}
                </Button>
              </div>
            </div>
          )}

          {/* Edit Form */}
          {showEditForm && (
            <EditTaskForm task={task} onClose={() => setShowEditForm(false)} onSave={async (updates) => {
              await updateTask.mutateAsync({ id: taskId, ...updates });
              toast.success("Cập nhật thành công!");
              setShowEditForm(false);
            }} isPending={updateTask.isPending} />
          )}

          {/* Checklists */}
          {task.checklists && task.checklists.length > 0 && (
            <Section title={`☑ Checklists (${task.checklists.reduce((s, c) => s + (c.items?.length ?? 0), 0)})`}>
              <div className="p-3 space-y-2">
                {task.checklists.map((cl) => (
                  <div key={cl.id}>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">{cl.title}</p>
                    {cl.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1">
                        <input type="checkbox" checked={item.is_checked} readOnly className="accent-primary" />
                        <span className={`text-sm ${item.is_checked ? "line-through text-muted-foreground" : ""}`}>{item.content}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Project Members */}
          {task.project_id && <TaskProjectMembers projectId={task.project_id} />}

          {/* Attachments */}
          <TaskAttachments taskId={taskId} />

          {/* Messenger Box */}
          <TaskMessenger taskId={taskId} projectId={task.project_id} />
        </div>
    </div>
    </>
  );
}

function TaskProjectMembers({ projectId }: { projectId: string }) {
  const supabase = createClient();

  // Fetch all users who have tasks in this project (distinct by user)
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["project-task-members", projectId],
    queryFn: async () => {
      // Get distinct assignees + assigners from tasks in this project
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assignee_id, assigner_id, dept_id, team_id")
        .eq("project_id", projectId)
        .neq("status", "cancelled");

      if (!tasks || tasks.length === 0) return [];

      const userIds = new Set<string>();
      const deptIds = new Set<string>();
      const teamIds = new Set<string>();

      tasks.forEach((t: any) => {
        if (t.assignee_id) userIds.add(t.assignee_id);
        if (t.assigner_id) userIds.add(t.assigner_id);
        if (t.dept_id) deptIds.add(t.dept_id);
        if (t.team_id) teamIds.add(t.team_id);
      });

      // Get dept heads & center directors for involved departments
      if (deptIds.size > 0) {
        const { data: depts } = await supabase
          .from("departments")
          .select("head_user_id, center_id")
          .in("id", Array.from(deptIds));
        if (depts) {
          depts.forEach((d: any) => {
            if (d.head_user_id) userIds.add(d.head_user_id);
          });
          // Get center directors
          const centerIds = [...new Set(depts.map((d: any) => d.center_id).filter(Boolean))];
          if (centerIds.length > 0) {
            const { data: centers } = await supabase
              .from("centers")
              .select("director_id")
              .in("id", centerIds);
            if (centers) centers.forEach((c: any) => { if (c.director_id) userIds.add(c.director_id); });
          }
        }
      }

      // Get team leaders for involved teams
      if (teamIds.size > 0) {
        const { data: teams } = await supabase
          .from("teams")
          .select("leader_id")
          .in("id", Array.from(teamIds));
        if (teams) teams.forEach((t: any) => { if (t.leader_id) userIds.add(t.leader_id); });
      }

      if (userIds.size === 0) return [];

      // Fetch user details
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, role, avatar_url, job_title")
        .in("id", Array.from(userIds))
        .eq("is_active", true)
        .order("full_name");

      return users || [];
    },
    enabled: !!projectId,
  });

  if (isLoading || members.length === 0) return null;

  // Sort by role level (highest first)
  const ROLE_ORDER: Record<string, number> = { admin: 0, director: 1, leader: 1, head: 2, team_leader: 3, staff: 4 };
  const sorted = [...members].sort((a: any, b: any) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));

  return (
    <Section title={`👥 Thành viên dự án (${sorted.length})`}>
      <div className="p-3 space-y-1.5">
        {sorted.map((m: any) => (
          <div key={m.id} className="flex items-center gap-2 py-1">
            <UserAvatar name={m.full_name} color={(ROLE_CONFIG as any)[m.role]?.color} size="xs" src={m.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.full_name}</p>
              {m.job_title && <p className="text-[10px] text-muted-foreground truncate">{m.job_title}</p>}
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
              background: `${(ROLE_CONFIG as any)[m.role]?.color || '#6b7280'}20`,
              color: (ROLE_CONFIG as any)[m.role]?.color || '#6b7280',
            }}>
              {(ROLE_CONFIG as any)[m.role]?.label || m.role}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function EditTaskForm({ task, onClose, onSave, isPending }: {
  task: any; onClose: () => void; onSave: (u: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    status: task.status,
    deadline: task.deadline?.slice(0, 10) || "",
    kpi_weight: task.kpi_weight,
  });

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="border-2 border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
      <h3 className="text-base font-bold text-primary">Chỉnh sửa công việc</h3>
      <div>
        <label className={labelClass}>Tên công việc</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Trạng thái</label>
          <SearchSelect
            value={form.status}
            onChange={(val) => setForm({ ...form, status: val })}
            options={[
              { value: "pending", label: "Chờ xử lý" },
              { value: "in_progress", label: "Đang làm" },
              { value: "review", label: "Chờ duyệt" },
              { value: "completed", label: "Hoàn thành" },
            ]}
            placeholder="Chọn trạng thái..."
            className="mt-1"
          />
        </div>
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
            placeholder="Chọn ưu tiên..."
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Deadline</label>
          <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Trọng số KPI (1-10)</label>
          <input type="number" min={1} max={10} value={form.kpi_weight} onChange={(e) => setForm({ ...form, kpi_weight: parseInt(e.target.value) || 5 })} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Mô tả</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputClass + " h-auto py-2"} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" onClick={onClose}>Hủy</Button>
        <Button size="sm" variant="primary" onClick={() => onSave(form)} disabled={isPending}>
          {isPending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </div>
  );
}
