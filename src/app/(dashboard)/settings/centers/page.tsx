"use client";

import { useState } from "react";
import { useCenters, useCreateCenter, useUpdateCenter } from "@/lib/hooks/use-teams";
import { useQuery } from "@tanstack/react-query";
import { Section, Button, UserAvatar, Toggle, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/shared/ui/search-select";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { toast } from "sonner";

function useUsers() {
  return useQuery({
    queryKey: ["center-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ["center-departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
  });
}

export default function CentersSettingsPage() {
  const { data: centers = [], isLoading } = useCenters();
  const { data: users = [] } = useUsers();
  const { data: departments = [] } = useDepartments();
  const createMutation = useCreateCenter();
  const updateMutation = useUpdateCenter();
  const [showCreate, setShowCreate] = useState(false);
  const [editCenter, setEditCenter] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ name: "", code: "", description: "", director_id: "" });

  const handleCreate = () => {
    if (!createForm.name) {
      toast.error("Vui lòng nhập tên trung tâm");
      return;
    }
    createMutation.mutate(createForm, {
      onSuccess: () => {
        setShowCreate(false);
        setCreateForm({ name: "", code: "", description: "", director_id: "" });
      },
    });
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Trung tâm</h2>
          <p className="text-base text-muted-foreground mt-0.5">{centers.length} trung tâm</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Thêm trung tâm</Button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">Tạo trung tâm mới</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tên trung tâm *</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Trung tâm BIM" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mã trung tâm</label>
                  <input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="BIM" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mô tả</label>
                <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Mô tả ngắn..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Giám đốc Trung tâm</label>
                <SearchSelect
                  value={createForm.director_id}
                  onChange={(val) => setCreateForm({ ...createForm, director_id: val })}
                  options={users.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
                  placeholder="— Chọn —"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setShowCreate(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Đang tạo..." : "Tạo trung tâm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editCenter && (
        <EditCenterModal
          center={editCenter}
          users={users}
          onClose={() => setEditCenter(null)}
          onSave={(updates) => updateMutation.mutate({ id: editCenter.id, ...updates }, { onSuccess: () => setEditCenter(null) })}
          isPending={updateMutation.isPending}
        />
      )}

      <Section title="Danh sách trung tâm">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}</div>
        ) : centers.length === 0 ? (
          <div className="p-6"><EmptyState icon="🏛️" title="Chưa có trung tâm" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  {["Mã", "Tên trung tâm", "Giám đốc", "Phòng ban", "Nhân sự", "Mô tả", "Trạng thái", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centers.map((center: any) => {
                  const centerDepts = departments.filter((d: any) => d.center_id === center.id);
                  const centerUsers = users.filter((u: any) => u.center_id === center.id || centerDepts.some((d: any) => d.id === u.dept_id));
                  return (
                    <tr key={center.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-primary font-bold">{center.code || "—"}</td>
                      <td className="px-4 py-3 text-base font-semibold">{center.name}</td>
                      <td className="px-4 py-3">
                        {center.director ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={center.director.full_name} color={ROLE_CONFIG[center.director.role as keyof typeof ROLE_CONFIG]?.color} size="xs" />
                            <span className="text-sm">{center.director.full_name}</span>
                          </div>
                        ) : <span className="text-sm text-muted-foreground">Chưa gán</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium">{centerDepts.length}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">phòng</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium">{centerUsers.length}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">người</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{center.description || "—"}</td>
                      <td className="px-4 py-3">
                        <Toggle
                          checked={center.is_active}
                          onChange={(v) => updateMutation.mutate({ id: center.id, is_active: v })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEditCenter(center)} className="text-sm text-primary hover:underline">Sửa</button>
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

function EditCenterModal({ center, users, onClose, onSave, isPending }: {
  center: any; users: any[]; onClose: () => void; onSave: (u: any) => void; isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: center.name,
    code: center.code || "",
    description: center.description || "",
    director_id: center.director_id || "",
    is_active: center.is_active,
  });

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-bold">Sửa trung tâm: {center.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tên trung tâm *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mã trung tâm</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Mô tả</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Giám đốc Trung tâm</label>
            <SearchSelect
              value={form.director_id}
              onChange={(val) => setForm({ ...form, director_id: val })}
              options={users.map((u: any) => ({ value: u.id, label: u.full_name, sublabel: u.email }))}
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
          <Button variant="primary" onClick={() => onSave({ ...form, code: form.code ? form.code.toUpperCase() : null, director_id: form.director_id || null })} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
