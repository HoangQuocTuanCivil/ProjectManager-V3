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
import { SearchSelect } from "@/components/shared/search-select";
import { toast } from "sonner";
import type { TaskCreateInput, Department } from "@/lib/types";

import { TaskFormKPI } from "./task-form-kpi";
import { TaskFormWorkflow } from "./task-form-workflow";
import { TaskFormAssignment } from "./task-form-assignment";

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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">✕</button>
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


            <TaskFormAssignment
              isLeaderOrAdmin={!!isLeaderOrAdmin}
              isHead={!!isHead}
              isTeamLeader={isTeamLeader}
              user={user}
              form={form}
              update={update}
              departments={departments}
              selectedDeptIds={selectedDeptIds}
              toggleDept={toggleDept}
              leaderAssignMode={leaderAssignMode}
              setLeaderAssignMode={setLeaderAssignMode}
              setSelectedDeptIds={setSelectedDeptIds}
              selectedTeamId={selectedTeamId}
              setSelectedTeamId={setSelectedTeamId}
              deptTeams={deptTeams}
              activeUsers={activeUsers}
              teamMembers={teamMembers}
              myTeam={myTeam}
              workflowId={workflowId}
              hasExecuteStep={hasExecuteStep}
            />

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
          <TaskFormWorkflow
            activeWorkflows={activeWorkflows}
            workflowId={workflowId}
            setWorkflowId={setWorkflowId}
            assignableSteps={assignableSteps}
            stepAssignees={stepAssignees}
            setStepAssignees={setStepAssignees}
            isLeaderOrAdmin={!!isLeaderOrAdmin}
            formDeptId={form.dept_id}
            departments={departments}
            selectedTeamId={selectedTeamId}
            activeUsers={activeUsers}
            isTeamLeader={isTeamLeader}
            myTeam={myTeam}
            user={user}
          />

          {/* KPI Expected Section */}
          <TaskFormKPI
            kpiWeight={form.kpi_weight}
            expectVolume={form.expect_volume}
            expectQuality={form.expect_quality}
            expectDifficulty={form.expect_difficulty}
            expectAhead={form.expect_ahead}
            onUpdate={(key, val) => update(key, val)}
          />

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
