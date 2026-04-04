"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateTask } from "@/lib/hooks/use-tasks";
import { useProjects } from "@/lib/hooks/use-projects";
import { useUsers } from "@/lib/hooks/use-users";
import { useTeams } from "@/lib/hooks/use-teams";
import { useWorkflows } from "@/lib/hooks/use-workflows";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/shared";
import { SearchSelect } from "@/shared/ui/search-select";
import { calcKPIScore } from "@/lib/utils/kpi";
import { toast } from "sonner";
import type { TaskCreateInput, Department } from "@/lib/types";

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

export function TaskForm({ onClose }: { onClose: () => void }) {
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: workflows = [] } = useWorkflows();
  const { data: departments = [] } = useDepartments();
  const { user } = useAuthStore();
  const createTask = useCreateTask();
  const activeUsers = users.filter((u: any) => u.is_active);
  const activeWorkflows = workflows.filter((w: any) => w.is_active);

  // Role checks
  const isLeaderOrAdmin = user && ["admin", "leader"].includes(user.role);
  const isHead = user?.role === "head";

  // Fetch teams in user's department (for Head role)
  const { data: deptTeams = [] } = useTeams(user?.dept_id || undefined);

  // Check if current user is a team leader
  const { data: myLedTeams = [] } = useQuery({
    queryKey: ["my-led-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, dept_id")
        .eq("leader_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && ["staff", "head"].includes(user.role),
  });
  const isTeamLeader = myLedTeams.length > 0;
  const myTeam = myLedTeams[0]; // Primary team the user leads

  // Directly fetch members for the team leader's team(s) — bypass useUsers() filtering
  const { data: directTeamMembers = [] } = useQuery({
    queryKey: ["my-team-members", myLedTeams.map((t: any) => t.id).join(",")],
    queryFn: async () => {
      const teamIds = myLedTeams.map((t: any) => t.id);
      if (teamIds.length === 0) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, dept_id, team_id, is_active")
        .in("team_id", teamIds)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: isTeamLeader,
  });

  const [workflowId, setWorkflowId] = useState("");
  const [stepAssignees, setStepAssignees] = useState<Record<string, string>>({});
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [leaderAssignMode, setLeaderAssignMode] = useState<"dept" | "individual">("dept");

  const toggleDept = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  // Get users for team leader to assign
  // Team leader: use directTeamMembers (fetched separately) + activeUsers from useUsers() as supplement
  const teamMembers = isTeamLeader
    ? (() => {
        // Combine directTeamMembers + activeUsers, deduplicate, exclude self
        const combined = [...directTeamMembers];
        for (const u of activeUsers) {
          if (!combined.find((m: any) => m.id === u.id)) {
            combined.push(u);
          }
        }
        return combined.filter((u: any) => u.id !== user?.id);
      })()
    : selectedTeamId
    ? activeUsers.filter((u: any) => u.team_id === selectedTeamId)
    : activeUsers;

  // Get selected workflow's steps (excluding "create" step)
  const selectedWorkflow = activeWorkflows.find((w: any) => w.id === workflowId);
  const assignableSteps = selectedWorkflow?.steps
    ?.filter((s: any) => !["create"].includes(s.step_type))
    ?.sort((a: any, b: any) => a.step_order - b.step_order) || [];
  // When workflow has "execute" step → hide standalone "Giao cho" field (it's merged into workflow steps)
  const hasExecuteStep = assignableSteps.some((s: any) => s.step_type === "execute");

  const stepTypeLabels: Record<string, string> = {
    execute: "Người thực hiện",
    review: "Người kiểm tra",
    approve: "Người duyệt",
    submit: "Người nộp",
    assign: "Người phân công",
    revise: "Người sửa",
    custom: "Người phụ trách",
  };

  const [form, setForm] = useState<TaskCreateInput & { expect_volume: number; expect_ahead: number; expect_quality: number; expect_difficulty: number }>({
    title: "",
    description: "",
    project_id: "",
    assignee_id: "",
    dept_id: "",
    team_id: "",
    priority: "medium",
    task_type: "product",
    kpi_weight: 5,
    expect_volume: 100,
    expect_ahead: 100,
    expect_quality: 80,
    expect_difficulty: 50,
    start_date: new Date().toISOString().slice(0, 10),
    deadline: "",
  });

  const expectScore = calcKPIScore(form.expect_volume, form.expect_quality, form.expect_difficulty, form.expect_ahead);

  const update = useCallback((key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val })), []);

  // Helper: create a single task + apply workflow
  const createSingleTask = async (submitData: typeof form) => {
    const newTask = await createTask.mutateAsync(submitData);
    if (workflowId && newTask?.id) {
      const { data: steps } = await supabase
        .from("workflow_steps")
        .select("id, step_type")
        .eq("template_id", workflowId)
        .order("step_order", { ascending: true });
      if (steps && steps.length > 0) {
        const hasAssignees = Object.keys(stepAssignees).some((k) => stepAssignees[k]);
        if (hasAssignees) {
          await supabase
            .from("tasks")
            .update({ metadata: { ...((newTask.metadata ?? {}) as Record<string, any>), step_assignees: stepAssignees } })
            .eq("id", newTask.id);
        }
        const executeStep = steps.find((s: any) => s.step_type === "execute");
        if (executeStep && stepAssignees[executeStep.id]) {
          await supabase
            .from("tasks")
            .update({ assignee_id: stepAssignees[executeStep.id] })
            .eq("id", newTask.id);
        }
        await supabase.from("task_workflow_state").insert({
          task_id: newTask.id,
          template_id: workflowId,
          current_step_id: steps[0].id,
          entered_at: new Date().toISOString(),
        });
        if (steps[0].step_type === "create" && steps.length > 1) {
          await supabase.rpc("fn_workflow_advance", {
            p_task: newTask.id,
            p_actor: user!.id,
            p_result: "completed",
            p_note: "Tự động chuyển sau khi tạo task",
          });
        }
      }
    }
    return newTask;
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    try {
      if (isLeaderOrAdmin && leaderAssignMode === "dept" && selectedDeptIds.length > 0) {
        // Leader: create one task per selected department
        for (const deptId of selectedDeptIds) {
          const submitData = { ...form, dept_id: deptId, assignee_id: "" };
          await createSingleTask(submitData);
        }
        toast.success(`Đã giao việc cho ${selectedDeptIds.length} phòng ban!`);
      } else if (isLeaderOrAdmin && leaderAssignMode === "individual" && form.assignee_id) {
        // Leader: assign directly to an individual — populate dept_id/team_id from assignee
        const assignee = activeUsers.find((u: any) => u.id === form.assignee_id);
        const submitData = {
          ...form,
          dept_id: assignee?.dept_id || form.dept_id || "",
          team_id: assignee?.team_id || form.team_id || "",
        };
        await createSingleTask(submitData);
        toast.success("Đã giao việc trực tiếp cho cá nhân!");
      } else if (isHead && selectedTeamId) {
        // Head: assign to team
        const submitData = { ...form, team_id: selectedTeamId, dept_id: user?.dept_id || "" };
        await createSingleTask(submitData);
        toast.success("Đã giao việc cho nhóm!");
      } else if (isTeamLeader && myTeam) {
        // Team Leader: assign to member in their team
        const submitData = { ...form, team_id: myTeam.id, dept_id: myTeam.dept_id };
        await createSingleTask(submitData);
        toast.success("Đã giao việc cho thành viên!");
      } else {
        // Head direct assignment or fallback
        await createSingleTask(form);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo task");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold">Giao việc mới + KPI kỳ vọng</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">Tên công việc *</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Mô hình kết cấu dầm chủ cầu Hồng Phong"
                className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-secondary text-base focus:border-primary focus:outline-none font-medium"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Dự án</label>
              <SearchSelect
                value={form.project_id ?? ""}
                onChange={(val) => update("project_id", val)}
                options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                placeholder="Chọn dự án..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Loại</label>
              <SearchSelect
                value={form.task_type}
                onChange={(val) => update("task_type", val)}
                options={[
                  { value: "product", label: "Giao khoán sản phẩm" },
                  { value: "task", label: "Công việc thường" },
                ]}
                placeholder="Chọn loại..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Ưu tiên</label>
              <SearchSelect
                value={form.priority}
                onChange={(val) => update("priority", val)}
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

            
            {isLeaderOrAdmin && (
              <div className="col-span-2 space-y-3">
                {/* Toggle: Dept vs Individual */}
                <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => { setLeaderAssignMode("dept"); update("assignee_id", ""); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      leaderAssignMode === "dept"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🏢 Giao theo phòng
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLeaderAssignMode("individual"); setSelectedDeptIds([]); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      leaderAssignMode === "individual"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    👤 Giao trực tiếp cá nhân
                  </button>
                </div>

                {leaderAssignMode === "dept" ? (
                  <div>
                    <label className="text-sm text-muted-foreground font-medium">Giao cho phòng ban * {selectedDeptIds.length > 0 && <span className="text-primary">({selectedDeptIds.length} phòng)</span>}</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {departments.map((d) => {
                        const isSelected = selectedDeptIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDept(d.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                              isSelected
                                ? "bg-primary text-white border-primary"
                                : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {isSelected && "✓ "}{d.name}{d.code ? ` (${d.code})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm text-muted-foreground font-medium">Chọn cá nhân được giao</label>
                    <SearchSelect
                      value={form.assignee_id || ""}
                      onChange={(val) => update("assignee_id", val)}
                      options={activeUsers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.department?.name || u.email }))}
                      placeholder="Tìm và chọn nhân viên..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            
            {isHead && (
              <div className="col-span-2 space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground font-medium">Giao cho nhóm</label>
                  <SearchSelect
                    value={selectedTeamId}
                    onChange={(val) => {
                      setSelectedTeamId(val);
                      update("assignee_id", "");
                    }}
                    options={deptTeams.map((t: any) => ({ value: t.id, label: t.name, sublabel: t.leader ? `TN: ${t.leader.full_name}` : undefined }))}
                    placeholder="— Chọn nhóm hoặc giao trực tiếp —"
                    className="mt-1"
                  />
                </div>
                {/* Head: assign to a member within the selected team */}
                {selectedTeamId && !(workflowId && hasExecuteStep) && (() => {
                  const membersInTeam = activeUsers.filter((u: any) => u.team_id === selectedTeamId && u.id !== user?.id);
                  const deptFallback = activeUsers.filter((u: any) => u.id !== user?.id);
                  const displayUsers = membersInTeam.length > 0 ? membersInTeam : deptFallback;
                  return (
                    <div>
                      <label className="text-sm text-muted-foreground font-medium">
                        Chọn thành viên
                        {membersInTeam.length === 0 && <span className="text-amber-500 ml-1">(nhóm chưa có thành viên — hiển thị tất cả phòng ban)</span>}
                      </label>
                      <SearchSelect
                        value={form.assignee_id || ""}
                        onChange={(val) => update("assignee_id", val)}
                        options={displayUsers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
                        placeholder="Chọn thành viên..."
                        className="mt-1"
                      />
                    </div>
                  );
                })()}
                {/* Head can also assign directly to a user (optional) when no team is selected */}
                {!selectedTeamId && !(workflowId && hasExecuteStep) && (
                  <div>
                    <label className="text-sm text-muted-foreground font-medium">Hoặc giao trực tiếp cho</label>
                    <SearchSelect
                      value={form.assignee_id || ""}
                      onChange={(val) => update("assignee_id", val)}
                      options={activeUsers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.department?.name || u.email }))}
                      placeholder="Chọn nhân viên..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            
            {isTeamLeader && !isHead && !isLeaderOrAdmin && (
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground font-medium">
                  Giao cho thành viên trong nhóm
                  {myTeam && <span className="text-primary ml-1">({myTeam.name})</span>}
                </label>
                <SearchSelect
                  value={form.assignee_id || ""}
                  onChange={(val) => update("assignee_id", val)}
                  options={teamMembers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
                  placeholder="Chọn thành viên..."
                  className="mt-1"
                />
              </div>
            )}

            
            {!(workflowId && hasExecuteStep) && !isLeaderOrAdmin && !isHead && !isTeamLeader && (
              <div>
                <label className="text-sm text-muted-foreground font-medium">Giao cho</label>
                <SearchSelect
                  value={form.assignee_id || ""}
                  onChange={(val) => update("assignee_id", val)}
                  options={activeUsers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.department?.name || u.email }))}
                  placeholder="Chọn nhân viên..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground font-medium">Ngày bắt đầu</label>
              <input type="date" value={form.start_date || ""} onChange={(e) => update("start_date", e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Deadline</label>
              <input type="date" value={form.deadline || ""} onChange={(e) => update("deadline", e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-secondary text-base focus:border-primary focus:outline-none" />
            </div>
          </div>

          {/* Workflow Selection */}
          {activeWorkflows.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground font-medium">Áp dụng Workflow</label>
                <SearchSelect
                  value={workflowId}
                  onChange={(val) => { setWorkflowId(val); setStepAssignees({}); }}
                  options={[
                    { value: "", label: "Không áp dụng workflow" },
                    ...activeWorkflows.map((w: any) => ({ value: w.id, label: `${w.name} (${w.scope})` })),
                  ]}
                  placeholder="Không áp dụng workflow"
                  className="mt-1"
                />
              </div>

              {/* Step assignees — shown when workflow is selected, only for Head/Staff (not Leader/Admin) */}
              {workflowId && assignableSteps.length > 0 && !isLeaderOrAdmin && (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50 space-y-3">
                  <h4 className="text-sm font-bold text-blue-700 flex items-center gap-1">
                    Phân công theo từng bước quy trình
                    {form.dept_id && (
                      <span className="text-[11px] font-normal text-blue-500 ml-1">
                        — {departments.find((d) => d.id === form.dept_id)?.name || ""}
                      </span>
                    )}
                  </h4>
                  {isLeaderOrAdmin && !form.dept_id && (
                    <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      Vui lòng chọn phòng ban trước để hiển thị danh sách nhân sự
                    </p>
                  )}
                  {(!isLeaderOrAdmin || form.dept_id) && (
                    <div className="grid grid-cols-1 gap-3">
                      {assignableSteps.map((step: any) => {
                        // "execute" step: restrict to selected team members
                        // "review"/"approve"/other steps: expand to dept + leadership
                        const isExecuteStep = step.step_type === "execute";
                        let stepUsers: any[];

                        if (isExecuteStep) {
                          // Executor: team-scoped
                          stepUsers = selectedTeamId
                            ? activeUsers.filter((u: any) => u.team_id === selectedTeamId)
                            : form.dept_id
                            ? activeUsers.filter((u: any) => u.dept_id === form.dept_id)
                            : isTeamLeader && myTeam
                            ? activeUsers.filter((u: any) => u.team_id === myTeam.id)
                            : activeUsers;
                        } else {
                          // Reviewer / Approver: dept + leadership
                          const deptId = form.dept_id || user?.dept_id;
                          stepUsers = activeUsers.filter((u: any) =>
                            u.dept_id === deptId ||
                            ["admin", "leader"].includes(u.role) ||
                            (selectedTeamId && u.team_id === selectedTeamId)
                          );
                        }
                        return (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className="flex items-center gap-2 min-w-[140px]">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                style={{ backgroundColor: step.color || "#6366f1" }}
                              >
                                {step.step_order}
                              </span>
                              <span className="text-sm font-medium text-foreground">
                                {stepTypeLabels[step.step_type] || step.name}
                              </span>
                            </div>
                            <SearchSelect
                              value={stepAssignees[step.id] || ""}
                              onChange={(val) => setStepAssignees((prev) => ({ ...prev, [step.id]: val }))}
                              options={stepUsers.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
                              placeholder="Chọn người phụ trách..."
                              className="flex-1 h-10 bg-white"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* KPI Expected Section */}
          <div className="border-2 border-primary/30 rounded-xl p-4 bg-primary/5">
            <h3 className="text-base font-bold text-primary mb-3">KPI kỳ vọng (nhập khi giao việc)</h3>

            <div className="space-y-3">
              {/* KPI Weight */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-24">Trọng số (W)</label>
                <input
                  type="range" min="1" max="10" value={form.kpi_weight}
                  onChange={(e) => update("kpi_weight", +e.target.value)}
                  className="flex-1 accent-primary"
                />
                <span className="font-mono text-base font-bold text-primary w-8 text-right">{form.kpi_weight}/10</span>
              </div>

              {/* KL */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-24">Khối lượng (40%)</label>
                <input
                  type="range" min="0" max="100" step="5" value={form.expect_volume}
                  onChange={(e) => update("expect_volume", +e.target.value)}
                  className="flex-1 accent-sky-400"
                />
                <span className="font-mono text-sm text-sky-400 w-8 text-right">{form.expect_volume}</span>
              </div>

              {/* CL */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-24">Chất lượng (30%)</label>
                <input
                  type="range" min="0" max="100" step="5" value={form.expect_quality}
                  onChange={(e) => update("expect_quality", +e.target.value)}
                  className="flex-1 accent-green-400"
                />
                <span className="font-mono text-sm text-green-400 w-8 text-right">{form.expect_quality}</span>
              </div>

              {/* ĐK */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-24">Độ khó (20%)</label>
                <input
                  type="range" min="0" max="100" step="5" value={form.expect_difficulty}
                  onChange={(e) => update("expect_difficulty", +e.target.value)}
                  className="flex-1 accent-amber-400"
                />
                <span className="font-mono text-sm text-amber-400 w-8 text-right">{form.expect_difficulty}</span>
              </div>

              {/* VTĐ */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-24">Vượt T.Đ (10%)</label>
                <input
                  type="range" min="0" max="100" step="5" value={form.expect_ahead}
                  onChange={(e) => update("expect_ahead", +e.target.value)}
                  className="flex-1 accent-purple-400"
                />
                <span className="font-mono text-sm text-purple-400 w-8 text-right">{form.expect_ahead}</span>
              </div>

              {/* Score Preview */}
              <div className="flex items-center justify-center gap-4 pt-3 border-t border-primary/20">
                <div className="text-center">
                  <p className="text-3xl font-bold font-mono text-primary">{expectScore}</p>
                  <p className="text-[11px] text-muted-foreground">Điểm KPI kỳ vọng</p>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                  {form.expect_volume}×0.4 + {form.expect_quality}×0.3 + {form.expect_difficulty}×0.2 + {form.expect_ahead}×0.1 = {expectScore}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="Mô tả chi tiết yêu cầu, scope, deliverables..."
              className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-card">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={createTask.isPending || !form.title.trim()}>
            {createTask.isPending ? "Đang tạo..." : "Giao việc + KPI"}
          </Button>
        </div>
      </div>
    </div>
  );
}
