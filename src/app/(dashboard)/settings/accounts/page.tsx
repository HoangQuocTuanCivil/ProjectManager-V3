"use client";

import { useState, useMemo } from "react";
import { useUsers, useUpdateUser, useDeleteUser, useResetPassword, useCreateUser, useCustomRoles, useAllTeams, useCenters } from "@/lib/hooks/use-data";
import { Section, Button, UserAvatar, RoleBadge, Toggle, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/shared/ui/search-select";
import { ROLE_CONFIG, formatDate } from "@/lib/utils/kpi";
import type { UserRole } from "@/lib/types";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "leader", label: "Lãnh đạo" },
  { value: "head", label: "Trưởng phòng" },
  { value: "team_leader", label: "Trưởng nhóm" },
  { value: "staff", label: "Nhân viên" },
];

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code, center_id, head_user_id").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export default function AccountsSettingsPage() {
  const { data: users = [], isLoading } = useUsers();
  const { data: departments = [] } = useDepartments();
  const { data: allTeams = [] } = useAllTeams();
  const { data: customRoles = [] } = useCustomRoles();
  const { data: allCenters = [] } = useCenters();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();
  const createUser = useCreateUser();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetPwUser, setResetPwUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");

  //  Cascading filter states 
  const [filterCenter, setFilterCenter] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");

  // Dept options scoped by center
  const filterDeptOptions = useMemo(() => {
    if (filterCenter === "all") return departments;
    return departments.filter((d: any) => d.center_id === filterCenter);
  }, [departments, filterCenter]);

  // Team options scoped by dept
  const filterTeamOptions = useMemo(() => {
    const activeTeams = allTeams.filter((t: any) => t.is_active !== false);
    if (filterDept !== "all") return activeTeams.filter((t: any) => t.dept_id === filterDept);
    if (filterCenter !== "all") {
      const deptIds = filterDeptOptions.map((d: any) => d.id);
      return activeTeams.filter((t: any) => deptIds.includes(t.dept_id));
    }
    return activeTeams;
  }, [allTeams, filterDept, filterCenter, filterDeptOptions]);

  // Create form
  const [createForm, setCreateForm] = useState({ email: "", password: "", full_name: "", role: "staff", center_id: "", dept_id: "", team_id: "", job_title: "" });

  // Cascade: create form dept options by center
  const createDeptsFiltered = useMemo(() => {
    if (!createForm.center_id) return departments;
    return departments.filter((d: any) => d.center_id === createForm.center_id);
  }, [departments, createForm.center_id]);

  // Cascade: create form team options by dept
  const createTeamsFiltered = useMemo(() => {
    const active = allTeams.filter((t: any) => t.is_active);
    if (createForm.dept_id) return active.filter((t: any) => t.dept_id === createForm.dept_id);
    if (createForm.center_id) {
      const deptIds = createDeptsFiltered.map((d: any) => d.id);
      return active.filter((t: any) => deptIds.includes(t.dept_id));
    }
    return active;
  }, [allTeams, createForm.dept_id, createForm.center_id, createDeptsFiltered]);

  //  Apply all filters (include appointed roles) 
  const filtered = useMemo(() => {
    let list = users as any[];
    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u: any) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    // Center — include: center_id match, dept in center, center director, dept heads, team leaders
    if (filterCenter !== "all") {
      const deptIds = filterDeptOptions.map((d: any) => d.id);
      const center = (allCenters as any[]).find((c: any) => c.id === filterCenter);
      const directorId = center?.director_id;
      const headIds = filterDeptOptions.map((d: any) => d.head_user_id).filter(Boolean);
      const teamLeaderIds = allTeams.filter((t: any) => deptIds.includes(t.dept_id)).map((t: any) => t.leader_id).filter(Boolean);
      const appointedIds = new Set([directorId, ...headIds, ...teamLeaderIds].filter(Boolean));
      list = list.filter((u: any) =>
        u.center_id === filterCenter ||
        deptIds.includes(u.dept_id) ||
        appointedIds.has(u.id)
      );
    }
    // Department — include: dept_id match, dept head, team leaders in dept
    if (filterDept !== "all") {
      const dept = departments.find((d: any) => d.id === filterDept);
      const headId = dept?.head_user_id;
      const teamLeaderIds = allTeams.filter((t: any) => t.dept_id === filterDept).map((t: any) => t.leader_id).filter(Boolean);
      const appointedIds = new Set([headId, ...teamLeaderIds].filter(Boolean));
      list = list.filter((u: any) =>
        u.dept_id === filterDept ||
        appointedIds.has(u.id)
      );
    }
    // Team — include: team_id match, team leader
    if (filterTeam !== "all") {
      const team = allTeams.find((t: any) => t.id === filterTeam);
      const leaderId = team?.leader_id;
      list = list.filter((u: any) =>
        u.team_id === filterTeam ||
        u.id === leaderId
      );
    }
    return list;
  }, [users, search, filterCenter, filterDept, filterTeam, filterDeptOptions, allCenters, departments, allTeams]);

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.full_name) {
      toast.error("Vui lòng nhập email, mật khẩu và họ tên");
      return;
    }
    try {
      await createUser.mutateAsync(createForm);
      toast.success("Tạo tài khoản thành công!");
      setShowCreate(false);
      setCreateForm({ email: "", password: "", full_name: "", role: "staff", center_id: "", dept_id: "", team_id: "", job_title: "" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi tạo tài khoản");
    }
  };

  const handleUpdateUser = async (updates: Record<string, any>) => {
    try {
      await updateUser.mutateAsync({ id: editUser.id, ...updates });
      toast.success("Cập nhật thành công!");
      setEditUser(null);
    } catch (e: any) {
      toast.error(e.message || "Lỗi cập nhật");
    }
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Quản lý tài khoản</h2>
          <p className="text-base text-muted-foreground mt-0.5">{users.length} người dùng</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Tạo tài khoản</Button>
      </div>

      {/* Create User Form */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">Tạo tài khoản mới</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Họ tên *</label>
                  <input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="Nguyễn Văn A" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@company.com" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Mật khẩu *</label>
                  <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Tối thiểu 8 ký tự" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Chức danh</label>
                  <input value={createForm.job_title} onChange={(e) => setCreateForm({ ...createForm, job_title: e.target.value })} placeholder="Kỹ sư BIM" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Vai trò</label>
                  <SearchSelect
                    value={createForm.role}
                    onChange={(val) => setCreateForm({ ...createForm, role: val })}
                    options={ROLE_OPTIONS}
                    placeholder="Chọn vai trò..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Trung tâm</label>
                  <select
                    value={createForm.center_id}
                    onChange={(e) => setCreateForm({ ...createForm, center_id: e.target.value, dept_id: "", team_id: "" })}
                    className={inputClass}
                  >
                    <option value="">— Không —</option>
                    {(allCenters as any[]).filter((c: any) => c.is_active !== false).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phòng ban</label>
                  <SearchSelect
                    value={createForm.dept_id}
                    onChange={(val) => setCreateForm({ ...createForm, dept_id: val, team_id: "" })}
                    options={createDeptsFiltered.map((d: any) => ({ value: d.id, label: d.code ? `${d.code} — ${d.name}` : d.name }))}
                    placeholder="— Chọn —"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Nhóm</label>
                  <SearchSelect
                    value={createForm.team_id}
                    onChange={(val) => setCreateForm({ ...createForm, team_id: val })}
                    options={createTeamsFiltered.map((t: any) => ({ value: t.id, label: t.code ? `${t.code} — ${t.name}` : t.name }))}
                    placeholder="— Không —"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createUser.isPending}>
                {createUser.isPending ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          departments={departments}
          teams={allTeams}
          centers={allCenters as any[]}
          customRoles={customRoles}
          onClose={() => setEditUser(null)}
          onSave={handleUpdateUser}
          isPending={updateUser.isPending}
        />
      )}

      {/* Reset Password Modal */}
      {resetPwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 border border-border">
            <h3 className="text-lg font-semibold mb-1">Đặt lại mật khẩu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tài khoản: <span className="font-medium text-foreground">{resetPwUser.full_name}</span> ({resetPwUser.email})
            </p>
            <label className="text-sm text-muted-foreground font-medium">Mật khẩu mới</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="outline" onClick={() => setResetPwUser(null)}>Hủy</Button>
              <Button
                size="sm"
                disabled={newPassword.length < 6 || resetPassword.isPending}
                onClick={() => {
                  resetPassword.mutate({ id: resetPwUser.id, password: newPassword }, {
                    onSuccess: () => {
                      toast.success(`Đã đặt lại mật khẩu cho "${resetPwUser.full_name}"`);
                      setResetPwUser(null);
                    },
                    onError: (err: any) => toast.error(err.message || "Lỗi đặt lại mật khẩu"),
                  });
                }}
              >
                {resetPassword.isPending ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Cascading Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm người dùng..."
            className="w-52 h-9 pl-8 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
        </div>
        <select
          value={filterCenter}
          onChange={(e) => { setFilterCenter(e.target.value); setFilterDept("all"); setFilterTeam("all"); }}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none min-w-[140px]"
        >
          <option value="all">Tất cả Trung tâm</option>
          {(allCenters as any[]).filter((c: any) => c.is_active !== false).map((c: any) => (
            <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={(e) => { setFilterDept(e.target.value); setFilterTeam("all"); }}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none min-w-[140px]"
        >
          <option value="all">Tất cả Phòng ban</option>
          {filterDeptOptions.map((d: any) => (
            <option key={d.id} value={d.id}>{d.code ? `${d.code} — ${d.name}` : d.name}</option>
          ))}
        </select>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none min-w-[120px]"
        >
          <option value="all">Tất cả Nhóm</option>
          {filterTeamOptions.map((t: any) => (
            <option key={t.id} value={t.id}>{t.code ? `${t.code} — ${t.name}` : t.name}</option>
          ))}
        </select>
        {(filterCenter !== "all" || filterDept !== "all" || filterTeam !== "all") && (
          <button
            onClick={() => { setFilterCenter("all"); setFilterDept("all"); setFilterTeam("all"); }}
            className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            ✕ Xóa lọc
          </button>
        )}
      </div>

      {/* Users Table */}
      <Section title={`Danh sách (${filtered.length})`}>
        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState icon="👥" title="Không tìm thấy" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Người dùng", "Email", "Vai trò", "Trung tâm", "Phòng ban", "Nhóm", "Đăng nhập cuối", "Trạng thái", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.full_name} color={ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]?.color} size="sm" src={u.avatar_url} />
                        <div>
                          <p className="text-base font-semibold">{u.full_name}</p>
                          {u.job_title && <p className="text-[11px] text-muted-foreground">{u.job_title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {(() => {
                        const c = (allCenters as any[]).find((cc: any) => cc.id === u.center_id);
                        if (c) return c.code || c.name;
                        // Fallback: find center via dept
                        if (u.department?.center_id) {
                          const c2 = (allCenters as any[]).find((cc: any) => cc.id === u.department.center_id);
                          return c2 ? (c2.code || c2.name) : "—";
                        }
                        return "—";
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-sm">{u.department?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-sm">{u.team?.name || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">{u.last_login ? formatDate(u.last_login) : "Chưa"}</td>
                    <td className="px-4 py-2.5">
                      <Toggle
                        checked={u.is_active}
                        onChange={(v) => updateUser.mutate({ id: u.id, is_active: v })}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-sm text-primary hover:underline"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => { setResetPwUser(u); setNewPassword(""); }}
                          className="text-sm text-amber-600 hover:underline"
                        >
                          Đặt lại MK
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Xác nhận XÓA VĨNH VIỄN tài khoản "${u.full_name}"?\n\nHành động này không thể hoàn tác!`)) {
                              deleteUser.mutate(u.id, {
                                onSuccess: () => toast.success(`Đã xóa tài khoản "${u.full_name}"`),
                                onError: (err: any) => toast.error(err.message || "Lỗi xóa tài khoản"),
                              });
                            }
                          }}
                          className="text-sm text-red-500 hover:underline"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function EditUserModal({ user, departments, teams, centers, customRoles, onClose, onSave, isPending }: {
  user: any; departments: any[]; teams: any[]; centers: any[]; customRoles: any[]; onClose: () => void; onSave: (u: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    full_name: user.full_name || "",
    role: user.role,
    center_id: user.center_id || user.department?.center_id || "",
    dept_id: user.dept_id || "",
    team_id: user.team_id || "",
    job_title: user.job_title || "",
    custom_role_id: user.custom_role_id || "",
    is_active: user.is_active,
  });

  // Cascade: dept options by center
  const editDeptsFiltered = useMemo(() => {
    if (!form.center_id) return departments;
    return departments.filter((d: any) => d.center_id === form.center_id);
  }, [departments, form.center_id]);

  // Cascade: team options by dept
  const editTeamsFiltered = useMemo(() => {
    const active = teams.filter((t: any) => t.is_active !== false);
    if (form.dept_id) return active.filter((t: any) => t.dept_id === form.dept_id);
    if (form.center_id) {
      const deptIds = editDeptsFiltered.map((d: any) => d.id);
      return active.filter((t: any) => deptIds.includes(t.dept_id));
    }
    return active;
  }, [teams, form.dept_id, form.center_id, editDeptsFiltered]);

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa tài khoản: {user.full_name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Họ tên</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={user.email} disabled className={inputClass + " opacity-50 cursor-not-allowed"} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vai trò</label>
              <SearchSelect
                value={form.role}
                onChange={(val) => setForm({ ...form, role: val })}
                options={ROLE_OPTIONS}
                placeholder="Chọn vai trò..."
                className="mt-1"
              />
            </div>
            <div>
              <label className={labelClass}>Trung tâm</label>
              <select
                value={form.center_id}
                onChange={(e) => setForm({ ...form, center_id: e.target.value, dept_id: "", team_id: "" })}
                className={inputClass}
              >
                <option value="">— Không —</option>
                {centers.filter((c: any) => c.is_active !== false).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phòng ban</label>
              <SearchSelect
                value={form.dept_id}
                onChange={(val) => setForm({ ...form, dept_id: val, team_id: "" })}
                options={editDeptsFiltered.map((d: any) => ({ value: d.id, label: d.code ? `${d.code} — ${d.name}` : d.name }))}
                placeholder="— Không —"
                className="mt-1"
              />
            </div>
            <div>
              <label className={labelClass}>Nhóm</label>
              <SearchSelect
                value={form.team_id}
                onChange={(val) => setForm({ ...form, team_id: val })}
                options={editTeamsFiltered.map((t: any) => ({ value: t.id, label: t.code ? `${t.code} — ${t.name}` : t.name }))}
                placeholder="— Không —"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Chức danh</label>
              <input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Vai trò tùy chỉnh</label>
              <SearchSelect
                value={form.custom_role_id}
                onChange={(val) => setForm({ ...form, custom_role_id: val })}
                options={customRoles.map((r: any) => ({ value: r.id, label: r.name }))}
                placeholder="— Không —"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className={labelClass}>Trạng thái:</label>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm">{form.is_active ? "Hoạt động" : "Đã khóa"}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onSave(form)} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
