"use client";

import { SearchSelect } from "@/components/shared/search-select";
import type { Department } from "@/lib/types";

interface TaskFormAssignmentProps {
  isLeaderOrAdmin: boolean;
  isHead: boolean;
  isTeamLeader: boolean;
  user: any;
  form: { assignee_id?: string | null; dept_id?: string };
  update: (key: string, val: any) => void;
  departments: Department[];
  selectedDeptIds: string[];
  toggleDept: (deptId: string) => void;
  leaderAssignMode: "dept" | "individual";
  setLeaderAssignMode: (mode: "dept" | "individual") => void;
  setSelectedDeptIds: (ids: string[]) => void;
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  deptTeams: any[];
  activeUsers: any[];
  teamMembers: any[];
  myTeam: any;
  workflowId: string;
  hasExecuteStep: boolean;
}

export function TaskFormAssignment({
  isLeaderOrAdmin,
  isHead,
  isTeamLeader,
  user,
  form,
  update,
  departments,
  selectedDeptIds,
  toggleDept,
  leaderAssignMode,
  setLeaderAssignMode,
  setSelectedDeptIds,
  selectedTeamId,
  setSelectedTeamId,
  deptTeams,
  activeUsers,
  teamMembers,
  myTeam,
  workflowId,
  hasExecuteStep,
}: TaskFormAssignmentProps) {
  return (
    <>
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
    </>
  );
}
