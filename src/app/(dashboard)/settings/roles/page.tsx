"use client";

import { useState } from "react";
import { useCustomRoles, usePermissions, useCreateRole, useUpdateRole, useDeleteRole } from "@/lib/hooks/use-org-settings";
import { Section, Button, RoleBadge, EmptyState } from "@/components/shared";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import { Shield, ShieldCheck, Building2, User, Users, Check, X, Eye, Pencil } from "lucide-react";


const PERM_ICON = {
  full: { icon: Check, color: "text-green-500", label: "Đầy đủ" },
  view: { icon: Eye, color: "text-blue-400", label: "Chỉ xem" },
  edit: { icon: Pencil, color: "text-amber-500", label: "Chỉnh sửa" },
  none: { icon: X, color: "text-red-400/50", label: "Không" },
} as const;

type PermLevel = "full" | "view" | "edit" | "none";

interface PermRow {
  tab: string;
  description: string;
  admin: PermLevel;
  leader: PermLevel;
  head: PermLevel;
  team_leader: PermLevel;
  staff: PermLevel;
  notes?: Record<string, string>;
}

const PERMISSION_MATRIX: PermRow[] = [
  {
    tab: "Tổng quan",
    description: "Dashboard tổng quan",
    admin: "full", leader: "full", head: "view", team_leader: "view", staff: "view",
  },
  {
    tab: "Công việc",
    description: "Quản lý và giao việc",
    admin: "full", leader: "full", head: "full", team_leader: "edit", staff: "edit",
    notes: {
      head: "Giao việc cho nhân sự cấp phòng ban + nhóm thuộc phòng quản lý",
      team_leader: "Giao việc cho thành viên trong nhóm mình quản lý",
      staff: "Chỉ chỉnh sửa công việc được giao cho mình",
    },
  },
  {
    tab: "Dự án",
    description: "Quản lý dự án",
    admin: "full", leader: "full", head: "view", team_leader: "view", staff: "view",
    notes: {
      leader: "Tạo, sửa, quản lý thành viên dự án",
      head: "Chỉ xem, không tạo dự án mới",
    },
  },
  {
    tab: "KPI & Khoán",
    description: "Đánh giá KPI và phân khoán",
    admin: "full", leader: "full", head: "view", team_leader: "view", staff: "view",
  },
  {
    tab: "Goals & OKR",
    description: "Mục tiêu và kết quả then chốt",
    admin: "full", leader: "full", head: "edit", team_leader: "edit", staff: "view",
    notes: {
      leader: "Tạo OKR tất cả cấp",
      head: "Tạo OKR cấp phòng trở xuống",
      team_leader: "Tạo OKR cấp nhóm + cá nhân",
    },
  },
  {
    tab: "Workflow",
    description: "Quy trình công việc",
    admin: "full", leader: "full", head: "view", team_leader: "view", staff: "view",
  },
  {
    tab: "Báo cáo",
    description: "Báo cáo công việc và hiệu suất",
    admin: "full", leader: "full", head: "view", team_leader: "view", staff: "view",
    notes: {
      head: "Báo cáo trung tâm trở xuống (phòng, nhóm, nhân viên)",
      team_leader: "Báo cáo nhóm mình quản lý",
      staff: "Chỉ xem báo cáo cá nhân",
    },
  },
  {
    tab: "Cài đặt — Tài khoản",
    description: "Quản lý người dùng",
    admin: "full", leader: "full", head: "view", team_leader: "none", staff: "none",
  },
  {
    tab: "Cài đặt — Trung tâm",
    description: "Quản lý trung tâm",
    admin: "full", leader: "view", head: "view", team_leader: "none", staff: "none",
  },
  {
    tab: "Cài đặt — Phòng ban",
    description: "Quản lý phòng ban",
    admin: "full", leader: "full", head: "view", team_leader: "none", staff: "none",
  },
  {
    tab: "Cài đặt — Nhóm",
    description: "Quản lý nhóm",
    admin: "full", leader: "full", head: "full", team_leader: "none", staff: "none",
  },
  {
    tab: "Cài đặt — Vai trò & PQ",
    description: "Vai trò và phân quyền",
    admin: "full", leader: "view", head: "view", team_leader: "none", staff: "none",
  },
  {
    tab: "Cài đặt — Template & Form",
    description: "Mẫu công việc và biểu mẫu",
    admin: "full", leader: "full", head: "view", team_leader: "none", staff: "none",
  },
];

const ROLE_COLUMNS = [
  { key: "admin" as const, label: "Admin", icon: Shield, color: "#ef4444", desc: "Bảo trì & bảo dưỡng nền tảng" },
  { key: "leader" as const, label: "Lãnh đạo", icon: ShieldCheck, color: "#f59e0b", desc: "BĐH, GĐ TT, Phó TGĐ" },
  { key: "head" as const, label: "Trưởng phòng", icon: Building2, color: "#3b82f6", desc: "Quản lý phòng ban" },
  { key: "team_leader" as const, label: "Trưởng nhóm", icon: Users, color: "#8b5cf6", desc: "Quản lý nhóm" },
  { key: "staff" as const, label: "Nhân viên", icon: User, color: "#10b981", desc: "Thực thi công việc" },
];

function PermCell({ level, note }: { level: PermLevel; note?: string }) {
  const cfg = PERM_ICON[level];
  const Icon = cfg.icon;
  return (
    <td className="px-2 py-2.5 text-center">
      <div className="flex flex-col items-center gap-0.5">
        <Icon size={16} className={cfg.color} />
        <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
        {note && <span className="text-[9px] text-muted-foreground leading-tight max-w-[120px]">{note}</span>}
      </div>
    </td>
  );
}


export default function RolesSettingsPage() {
  const { data: roles = [], isLoading: rolesLoading } = useCustomRoles();
  const { data: permissions = [] } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [showMatrix, setShowMatrix] = useState(true);

  const permGroups = permissions.reduce((acc: Record<string, any[]>, p: any) => {
    const group = p.group_name || "Khác";
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Vai trò & Phân quyền</h2>
          <p className="text-base text-muted-foreground mt-0.5">4 cấp vai trò hệ thống · Quản lý quyền hạn người dùng</p>
        </div>
        <Button variant="primary" onClick={() => { setEditRole(null); setShowForm(true); }}>+ Tạo vai trò tùy chỉnh</Button>
      </div>

      {showForm && (
        <RoleFormModal
          role={editRole}
          permissions={permissions}
          permGroups={permGroups}
          onClose={() => { setShowForm(false); setEditRole(null); }}
        />
      )}

      
      <Section title="Vai trò hệ thống">
        <div className="p-4 grid grid-cols-4 gap-3">
          {ROLE_COLUMNS.map((col) => {
            const Icon = col.icon;
            return (
              <div key={col.key} className="bg-secondary/50 rounded-xl p-4 text-center border border-border/30 hover:border-border transition-colors">
                <div className="w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-base" style={{ background: col.color }}>
                  <Icon size={20} />
                </div>
                <p className="text-sm font-bold">{col.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{col.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      
      <Section title="Ma trận phân quyền theo cấp bậc">
        <div className="p-2">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-xs text-primary hover:underline mb-2 px-2"
          >
            {showMatrix ? "▼ Ẩn ma trận" : "▶ Hiện ma trận"}
          </button>
          {showMatrix && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border bg-secondary/30">
                    <th className="text-left px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-[220px]">Chức năng</th>
                    {ROLE_COLUMNS.map((col) => (
                      <th key={col.key} className="px-2 py-2.5 text-center" style={{ minWidth: 100 }}>
                        <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map((row, i) => (
                    <tr key={row.tab} className={`border-b border-border/30 ${i % 2 === 0 ? "bg-card" : "bg-secondary/10"}`}>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-semibold">{row.tab}</p>
                        <p className="text-[10px] text-muted-foreground">{row.description}</p>
                      </td>
                      {(["admin", "leader", "head", "team_leader", "staff"] as const).map((rk) => (
                        <PermCell key={rk} level={row[rk]} note={row.notes?.[rk]} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      
      <div className="flex items-center gap-4 px-4 py-2 bg-secondary/30 rounded-lg mx-4">
        {Object.entries(PERM_ICON).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <Icon size={14} className={cfg.color} />
              <span className="text-muted-foreground">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      
      <Section title={`Vai trò tùy chỉnh (${roles.length})`}>
        {rolesLoading ? (
          <div className="p-4 space-y-3">{[1, 2].map((i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}</div>
        ) : roles.length === 0 ? (
          <div className="p-6"><EmptyState icon="🔐" title="Chưa có vai trò tùy chỉnh" subtitle="Tạo vai trò mới để phân quyền chi tiết" /></div>
        ) : (
          <div className="divide-y divide-border/40">
            {roles.map((role: any) => (
              <CustomRoleItem
                key={role.id}
                role={role}
                onEdit={() => { setEditRole(role); setShowForm(true); }}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function CustomRoleItem({ role, onEdit }: { role: any; onEdit: () => void }) {
  const deleteRole = useDeleteRole();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteRole.mutateAsync(role.id);
      toast.success("Đã xóa vai trò");
    } catch (e: any) {
      toast.error(e.message || "Lỗi xóa");
    }
    setConfirmDelete(false);
  };

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <div className="w-8 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: role.color || "#6366f1" }}>
        {role.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">{role.name}</span>
          <RoleBadge role={role.base_role} />
        </div>
        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
      </div>
      <span className="text-[11px] text-muted-foreground mr-2">
        {role.permissions?.length || 0} quyền
      </span>
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-destructive">Xác nhận?</span>
          <button onClick={handleDelete} disabled={deleteRole.isPending} className="text-xs text-white bg-destructive px-2 py-1 rounded hover:brightness-110 disabled:opacity-50">
            {deleteRole.isPending ? "..." : "Xóa"}
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">Hủy</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="text-sm text-primary hover:underline">Sửa</button>
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-destructive hover:underline">Xóa</button>
        </div>
      )}
    </div>
  );
}

function RoleFormModal({ role, permissions, permGroups, onClose }: {
  role: any; permissions: any[]; permGroups: Record<string, any[]>; onClose: () => void;
}) {
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isEdit = !!role;

  const existingPermIds = (role?.permissions || []).map((p: any) => p.permission_id);
  const [form, setForm] = useState({
    name: role?.name || "",
    description: role?.description || "",
    base_role: role?.base_role || "staff",
    color: role?.color || "#6366f1",
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set(existingPermIds));

  const togglePerm = (id: string) => {
    const next = new Set(selectedPerms);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPerms(next);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Tên vai trò là bắt buộc"); return; }
    if (!form.base_role) { toast.error("Vui lòng chọn vai trò cơ sở"); return; }
    try {
      const payload = { ...form, permission_ids: Array.from(selectedPerms) };
      if (isEdit) {
        await updateRole.mutateAsync({ id: role.id, ...payload });
        toast.success("Cập nhật vai trò thành công!");
      } else {
        await createRole.mutateAsync(payload);
        toast.success("Tạo vai trò thành công!");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Lỗi");
    }
  };

  const isPending = createRole.isPending || updateRole.isPending;
  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">{isEdit ? `Sửa vai trò: ${role.name}` : "Tạo vai trò tùy chỉnh"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Tên vai trò *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: BIM Manager, QA Lead..." className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Kế thừa quyền từ *</label>
              <SearchSelect
                value={form.base_role}
                onChange={(val) => setForm({ ...form, base_role: val })}
                options={[
                  { value: "staff", label: "Nhân viên (cấp 1)" },
                  { value: "head", label: "Trưởng phòng (cấp 3)" },
                  { value: "leader", label: "Lãnh đạo (cấp 4)" },
                ]}
                placeholder="Chọn vai trò cơ sở"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Vai trò tùy chỉnh sẽ kế thừa quyền hạn từ vai trò cơ sở được chọn</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả chức năng vai trò" className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Màu sắc</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                <span className="text-sm text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          {Object.keys(permGroups).length > 0 && (
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Phân quyền bổ sung ({selectedPerms.size}/{permissions.length})
              </p>
              <div className="space-y-3">
                {Object.entries(permGroups).map(([group, perms]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(perms as any[]).map((p: any) => (
                        <label key={p.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-secondary/50 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={selectedPerms.has(p.id)}
                            onChange={() => togglePerm(p.id)}
                            className="rounded border-border"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo vai trò"}
          </Button>
        </div>
      </div>
    </div>
  );
}
