"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Section, Button, UserAvatar, Toggle, EmptyState } from "@/components/shared";
import { Landmark } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { toast } from "sonner";
import { useDeleteDepartment } from "@/lib/hooks/use-teams";
import { useMultiSelect } from "@/lib/hooks/use-multi-select";

const supabase = createClient();

function useCentersAll() {
  return useQuery({
    queryKey: ["dept-centers"],
    queryFn: async () => {
      const res = await fetch("/api/centers");
      if (!res.ok) throw new Error("Failed to fetch centers");
      return res.json();
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch departments");
      }
      return res.json();
    },
  });
}

function useUsers() {
  return useQuery({
    queryKey: ["dept-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch users");
      }
      return res.json();
    },
  });
}

function useTeamsAll() {
  return useQuery({
    queryKey: ["dept-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, dept_id, leader_id, is_active")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export default function DepartmentsSettingsPage() {
  const queryClient = useQueryClient();
  const { data: departments = [], isLoading } = useDepartments();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeamsAll();
  const { data: centers = [] } = useCentersAll();
  const deleteMutation = useDeleteDepartment();
  const { selected, toggle, toggleAll, clear, isAllSelected, isPartial } = useMultiSelect(departments as any[]);
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ name: "", code: "", description: "", head_user_id: "", center_id: "" });

  const createMutation = useMutation({
    mutationFn: async (form: typeof createForm) => {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạo phòng ban");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Tạo phòng ban thành công!");
      setShowCreate(false);
      setCreateForm({ name: "", code: "", description: "", head_user_id: "", center_id: "" });
    },
    onError: (e: any) => toast.error(e.message || "Lỗi tạo phòng ban"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi cập nhật");
      return data;
    },
    onMutate: async (variables: any) => {
      await queryClient.cancelQueries({ queryKey: ["departments"] });
      const previous = queryClient.getQueryData(["departments"]);
      queryClient.setQueryData(["departments"], (old: any[]) =>
        old?.map((d: any) => d.id === variables.id ? { ...d, ...variables } : d)
      );
      return { previous };
    },
    onError: (e: any, _v: any, context: any) => {
      if (context?.previous) queryClient.setQueryData(["departments"], context.previous);
      toast.error(e.message || "Lỗi cập nhật");
    },
    onSuccess: () => {
      toast.success("Cập nhật thành công!");
      setEditDept(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  const handleCreate = () => {
    if (!createForm.name || !createForm.code) {
      toast.error("Vui lòng nhập tên và mã phòng ban");
      return;
    }
    createMutation.mutate(createForm);
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Phòng ban</h2>
          <p className="text-base text-muted-foreground mt-0.5">{departments.length} phòng ban</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Thêm phòng ban</Button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">Tạo phòng ban mới</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tên phòng ban *</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Phòng Kỹ thuật" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mã phòng ban *</label>
                  <input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="KT" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mô tả</label>
                <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Mô tả ngắn..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trưởng phòng</label>
                <SearchSelect
                  value={createForm.head_user_id}
                  onChange={(val) => setCreateForm({ ...createForm, head_user_id: val })}
                  options={users.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
                  placeholder="— Chọn —"
                  className="mt-1"
                />
              </div>
              <div>
                <label className={labelClass}>Trung tâm</label>
                <select
                  value={createForm.center_id}
                  onChange={(e) => setCreateForm({ ...createForm, center_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">— Không thuộc trung tâm —</option>
                  {centers.filter((c: any) => c.is_active).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Đang tạo..." : "Tạo phòng ban"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editDept && (
        <EditDeptModal
          dept={editDept}
          users={users}
          onClose={() => setEditDept(null)}
          onSave={(updates) => updateMutation.mutate({ id: editDept.id, ...updates })}
          isPending={updateMutation.isPending}
          centers={centers}
        />
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl">
          <span className="text-sm font-medium">{selected.size} đã chọn</span>
          <div className="flex-1" />
          <button onClick={clear} className="text-sm text-muted-foreground hover:text-foreground">Bỏ chọn</button>
          <Button size="sm" variant="primary"
            className="!bg-destructive hover:!bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!confirm(`Xóa ${selected.size} phòng ban? Nhóm và nhân sự thuộc phòng ban sẽ được gỡ liên kết.`)) return;
              const ids = Array.from(selected);
              Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)))
                .then(() => { toast.success(`Đã xóa ${ids.length} phòng ban`); clear(); })
                .catch((e: any) => toast.error(e.message));
            }}
          >
            {deleteMutation.isPending ? "Đang xóa..." : `Xóa ${selected.size} phòng ban`}
          </Button>
        </div>
      )}

      <Section title="Danh sách phòng ban">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}</div>
        ) : departments.length === 0 ? (
          <div className="p-6"><EmptyState icon={<Landmark size={32} strokeWidth={1.5} />} title="Chưa có phòng ban" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" checked={isAllSelected}
                      ref={(el) => { if (el) el.indeterminate = isPartial; }}
                      onChange={toggleAll} className="rounded border-border" />
                  </th>
                  {["Mã", "Tên phòng ban", "Trung tâm", "Trưởng phòng", "Nhóm", "Nhân sự", "Mô tả", "Trạng thái", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept: any, idx: number) => {
                  const deptTeams = teams.filter((t: any) => t.dept_id === dept.id);
                  const deptUsers = users.filter((u: any) => u.dept_id === dept.id);
                  return (
                  <tr key={dept.id} className={`border-b border-border/40 hover:bg-secondary/20 transition-colors ${selected.has(dept.id) ? "bg-primary/5" : ""}`}>
                    <td className="w-10 px-4 py-3">
                      <input type="checkbox" checked={selected.has(dept.id)}
                        onChange={(e) => toggle(dept.id, idx, e.nativeEvent instanceof MouseEvent && (e.nativeEvent as MouseEvent).shiftKey)}
                        className="rounded border-border" />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-primary font-bold">{dept.code}</td>
                    <td className="px-4 py-3 text-base font-semibold">
                      {dept.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {(() => {
                        const c = centers.find((cc: any) => cc.id === dept.center_id);
                        return c ? (c.code ? `${c.code}` : c.name) : <span className="text-muted-foreground/50">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {dept.head ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar name={dept.head.full_name} color={ROLE_CONFIG[dept.head.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                          <span className="text-sm">{dept.head.full_name}</span>
                        </div>
                      ) : <span className="text-sm text-muted-foreground">Chưa gán</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{deptTeams.length}</span>
                      <span className="text-[11px] text-muted-foreground ml-1">nhóm</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium">{deptUsers.length}</span>
                      <span className="text-[11px] text-muted-foreground ml-1">người</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{dept.description || "—"}</td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={dept.is_active !== false}
                        onChange={(v) => updateMutation.mutate({ id: dept.id, is_active: v })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditDept(dept)}
                        className="text-sm text-primary hover:underline"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function EditDeptModal({ dept, users, onClose, onSave, isPending, centers }: {
  dept: any; users: any[]; onClose: () => void; onSave: (u: any) => void; isPending: boolean; centers: any[];
}) {
  const [form, setForm] = useState({
    name: dept.name,
    code: dept.code,
    description: dept.description || "",
    head_user_id: dept.head_user_id || "",
    center_id: dept.center_id || "",
    is_active: dept.is_active !== false,
  });

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa phòng ban: {dept.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tên phòng ban *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mã phòng ban *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Mô tả</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Trưởng phòng</label>
            <SearchSelect
              value={form.head_user_id}
              onChange={(val) => setForm({ ...form, head_user_id: val })}
              options={users.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
              placeholder="— Không —"
              className="mt-1"
            />
          </div>
          <div>
            <label className={labelClass}>Trạng thái:</label>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-sm">{form.is_active ? "Hoạt động" : "Ngừng"}</span>
          </div>
          <div>
            <label className={labelClass}>Trung tâm</label>
            <select
              value={form.center_id}
              onChange={(e) => setForm({ ...form, center_id: e.target.value })}
              className={inputClass}
            >
              <option value="">— Không thuộc trung tâm —</option>
              {centers.filter((c: any) => c.is_active).map((c: any) => (
                <option key={c.id} value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={() => onSave({ ...form, code: form.code.toUpperCase(), head_user_id: form.head_user_id || null, center_id: form.center_id || null })} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
