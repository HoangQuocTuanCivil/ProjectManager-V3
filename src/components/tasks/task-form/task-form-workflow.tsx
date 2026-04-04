"use client";

import { SearchSelect } from "@/components/shared/search-select";
import type { Department } from "@/lib/types";

const stepTypeLabels: Record<string, string> = {
  execute: "Người thực hiện",
  review: "Người kiểm tra",
  approve: "Người duyệt",
  submit: "Người nộp",
  assign: "Người phân công",
  revise: "Người sửa",
  custom: "Người phụ trách",
};

interface TaskFormWorkflowProps {
  activeWorkflows: any[];
  workflowId: string;
  setWorkflowId: (id: string) => void;
  assignableSteps: any[];
  stepAssignees: Record<string, string>;
  setStepAssignees: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isLeaderOrAdmin: boolean;
  formDeptId: string | undefined;
  departments: Department[];
  selectedTeamId: string;
  activeUsers: any[];
  isTeamLeader: boolean;
  myTeam: any;
  user: any;
}

export function TaskFormWorkflow({
  activeWorkflows,
  workflowId,
  setWorkflowId,
  assignableSteps,
  stepAssignees,
  setStepAssignees,
  isLeaderOrAdmin,
  formDeptId,
  departments,
  selectedTeamId,
  activeUsers,
  isTeamLeader,
  myTeam,
  user,
}: TaskFormWorkflowProps) {
  if (activeWorkflows.length === 0) return null;

  return (
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
            {formDeptId && (
              <span className="text-[11px] font-normal text-blue-500 ml-1">
                — {departments.find((d) => d.id === formDeptId)?.name || ""}
              </span>
            )}
          </h4>
          {isLeaderOrAdmin && !formDeptId && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              Vui lòng chọn phòng ban trước để hiển thị danh sách nhân sự
            </p>
          )}
          {(!isLeaderOrAdmin || formDeptId) && (
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
                    : formDeptId
                    ? activeUsers.filter((u: any) => u.dept_id === formDeptId)
                    : isTeamLeader && myTeam
                    ? activeUsers.filter((u: any) => u.team_id === myTeam.id)
                    : activeUsers;
                } else {
                  // Reviewer / Approver: dept + leadership
                  const deptId = formDeptId || user?.dept_id;
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
  );
}
