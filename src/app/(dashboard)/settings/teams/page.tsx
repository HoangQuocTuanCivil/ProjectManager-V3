"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAllTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from "@/lib/hooks/use-teams";
import { Section, Button, UserAvatar, Toggle, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/shared/ui/search-select";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { toast } from "sonner";
import type { Team } from "@/lib/types";

const supabase = createClient();

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

function useAllUsers() {
  return useQuery({
    queryKey: ["team-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, dept_id, team_id")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export default function TeamsSettingsPage() {
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading } = useAllTeams();
  const { data: departments = [] } = useDepartments();
  const { data: allUsers = [] } = useAllUsers();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", code: "", description: "", dept_id: "", leader_id: "" });

  const handleCreate = () => {
    if (!createForm.name || !createForm.dept_id) {
      toast.error("Vui lòng nhập tên nhóm và chọn phòng ban");
      return;
    }
    createTeam.mutate(createForm, {
      onSuccess: () => {
        setShowCreate(false);
        setCreateForm({ name: "", code: "", description: "", dept_id: "", leader_id: "" });
      },
    });
  };

  // Group teams by department
  const teamsByDept = departments.map((dept: any) => ({
    ...dept,
    teams: teams.filter((t: any) => t.dept_id === dept.id),
  }));

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Nhóm</h2>
          <p className="text-base text-muted-foreground mt-0.5">{teams.length} nhóm trong {departments.length} phòng ban</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Thêm nhóm</Button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">Tạo nhóm mới</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={labelClass}>Phòng ban *</label>
                <SearchSelect
                  value={createForm.dept_id}
                  onChange={(val) => setCreateForm({ ...createForm, dept_id: val, leader_id: "" })}
                  options={departments.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
                  placeholder="— Chọn phòng ban —"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tên nhóm *</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Nhóm Kết cấu" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mã nhóm</label>
                  <input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="KC" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mô tả</label>
                <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Mô tả ngắn..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trưởng nhóm</label>
                <SearchSelect
                  value={createForm.leader_id}
                  onChange={(val) => setCreateForm({ ...createForm, leader_id: val })}
                  options={allUsers
                    .filter((u: any) => !createForm.dept_id || u.dept_id === createForm.dept_id)
                    .map((u: any) => ({ value: u.id, label: u.full_name }))}
                  placeholder="— Chọn —"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createTeam.isPending}>
                {createTeam.isPending ? "Đang tạo..." : "Tạo nhóm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTeam && (
        <EditTeamModal
          team={editTeam}
          departments={departments}
          users={allUsers}
          onClose={() => setEditTeam(null)}
          onSave={(updates) => updateTeam.mutate({ id: editTeam.id, ...updates }, { onSuccess: () => setEditTeam(null) })}
          isPending={updateTeam.isPending}
        />
      )}

      {/* Manage Members Modal */}
      {manageTeam && (
        <ManageMembersModal
          team={manageTeam}
          users={allUsers}
          onClose={() => {
            setManageTeam(null);
            queryClient.invalidateQueries({ queryKey: ["team-users"] });
            queryClient.invalidateQueries({ queryKey: ["teams"] });
          }}
        />
      )}

      {/* Teams grouped by department */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}</div>
      ) : teams.length === 0 ? (
        <Section title="Danh sách nhóm">
          <div className="p-6"><EmptyState icon="👥" title="Chưa có nhóm nào" /></div>
        </Section>
      ) : (
        teamsByDept
          .filter((dept: any) => dept.teams.length > 0)
          .map((dept: any) => (
            <Section key={dept.id} title={`${dept.name} (${dept.code})`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Mã", "Tên nhóm", "Trưởng nhóm", "Thành viên", "Trạng thái", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dept.teams.map((team: any) => {
                      const memberCount = allUsers.filter((u: any) => u.team_id === team.id).length;
                      return (
                        <tr key={team.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm text-primary font-bold">{team.code || "—"}</td>
                          <td className="px-4 py-3 text-base font-semibold">{team.name}</td>
                          <td className="px-4 py-3">
                            {team.leader ? (
                              <div className="flex items-center gap-2">
                                <UserAvatar name={team.leader.full_name} color={ROLE_CONFIG.team_leader.color} size="xs" />
                                <span className="text-sm">{team.leader.full_name}</span>
                              </div>
                            ) : <span className="text-sm text-muted-foreground">Chưa gán</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setManageTeam(team)}
                              className="text-sm text-primary hover:underline"
                            >
                              {memberCount} thành viên
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Toggle
                              checked={team.is_active}
                              onChange={(v) => updateTeam.mutate({ id: team.id, is_active: v })}
                            />
                          </td>
                          <td className="px-4 py-3 flex gap-2">
                            <button onClick={() => setEditTeam(team)} className="text-sm text-primary hover:underline">Sửa</button>
                            <button
                              onClick={() => {
                                if (confirm(`Xóa nhóm "${team.name}"?`)) deleteTeam.mutate(team.id);
                              }}
                              className="text-sm text-red-500 hover:underline"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          ))
      )}
    </div>
  );
}

function EditTeamModal({ team, departments, users, onClose, onSave, isPending }: {
  team: Team; departments: any[]; users: any[]; onClose: () => void; onSave: (u: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: team.name,
    code: team.code || "",
    description: team.description || "",
    dept_id: team.dept_id,
    leader_id: team.leader_id || "",
    is_active: team.is_active,
  });

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa nhóm: {team.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={labelClass}>Phòng ban</label>
            <SearchSelect
              value={form.dept_id}
              onChange={(val) => setForm({ ...form, dept_id: val, leader_id: "" })}
              options={departments.map((d: any) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              placeholder="Chọn phòng ban..."
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tên nhóm *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mã nhóm</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Mô tả</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Trưởng nhóm</label>
            <SearchSelect
              value={form.leader_id}
              onChange={(val) => setForm({ ...form, leader_id: val })}
              options={users
                .filter((u: any) => u.dept_id === form.dept_id)
                .map((u: any) => ({ value: u.id, label: u.full_name }))}
              placeholder="— Không —"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className={labelClass}>Trạng thái:</label>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm">{form.is_active ? "Hoạt động" : "Ngừng"}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onSave({ ...form, leader_id: form.leader_id || null })} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ManageMembersModal({ team, users, onClose }: {
  team: Team; users: any[]; onClose: () => void;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const teamMembers = users.filter((u: any) => u.team_id === team.id);
  const availableUsers = users.filter((u: any) => u.dept_id === team.dept_id && u.team_id !== team.id);

  const addMember = async (userId: string) => {
    const { error } = await supabase.from("users").update({ team_id: team.id }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã thêm thành viên");
    queryClient.invalidateQueries({ queryKey: ["team-users"] });
  };

  const removeMember = async (userId: string) => {
    const { error } = await supabase.from("users").update({ team_id: null }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã xóa thành viên khỏi nhóm");
    queryClient.invalidateQueries({ queryKey: ["team-users"] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Thành viên nhóm: {team.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Current members */}
          <div>
            <h4 className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">Thành viên hiện tại ({teamMembers.length})</h4>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Chưa có thành viên</p>
            ) : (
              <div className="space-y-1.5">
                {teamMembers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={u.full_name}
                        color={u.id === team.leader_id ? ROLE_CONFIG.team_leader.color : ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color}
                        size="xs"
                      />
                      <span className="text-sm font-medium">{u.full_name}</span>
                      {u.id === team.leader_id && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Trưởng nhóm</span>
                      )}
                    </div>
                    {u.id !== team.leader_id && (
                      <button onClick={() => removeMember(u.id)} className="text-sm text-red-500 hover:underline">Xóa</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available users to add */}
          {availableUsers.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">Thêm thành viên</h4>
              <div className="space-y-1.5">
                {availableUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={u.full_name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                      <span className="text-sm">{u.full_name}</span>
                      {u.team_id && <span className="text-[11px] text-muted-foreground">(đã có nhóm khác)</span>}
                    </div>
                    <button
                      onClick={() => addMember(u.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      + Thêm
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}
