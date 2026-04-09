"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useProject, useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/features/projects";
import { Section, Button, EmptyState } from "@/components/shared";
import { Diamond } from "lucide-react";
import { formatDate } from "@/lib/utils/kpi";
import { SearchSelect } from "@/components/shared/search-select";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: "Sắp tới", color: "#3b82f6", bg: "#3b82f618" },
  reached: { label: "Đã đạt", color: "#10b981", bg: "#10b98118" },
  missed: { label: "Trễ hạn", color: "#ef4444", bg: "#ef444418" },
};

export default function ProjectMilestonesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: project } = useProject(projectId);
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", due_date: "", status: "upcoming" });

  const milestones = (project as any)?.milestones || [];
  const sorted = [...milestones].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: "", due_date: "", status: "upcoming" });
    setShowForm(true);
  };

  const openEdit = (m: any) => {
    setEditItem(m);
    setForm({ title: m.title, due_date: m.due_date || "", status: m.status || "upcoming" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.due_date) { toast.error("Nhập tên và ngày"); return; }
    try {
      if (editItem) {
        await updateMilestone.mutateAsync({ id: editItem.id, project_id: projectId, ...form, status: form.status as 'upcoming' | 'reached' | 'missed' });
        toast.success("Cập nhật milestone thành công!");
      } else {
        await createMilestone.mutateAsync({ project_id: projectId, ...form });
        toast.success("Tạo milestone thành công!");
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || "Lỗi");
    }
  };

  const handleDelete = async (m: any) => {
    if (!confirm(`Xóa milestone "${m.title}"?`)) return;
    try {
      await deleteMilestone.mutateAsync({ id: m.id, project_id: projectId });
      toast.success("Đã xóa milestone");
    } catch (e: any) {
      toast.error(e.message || "Lỗi xóa");
    }
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const isPending = createMilestone.isPending || updateMilestone.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Milestones ({milestones.length})</h3>
        <Button size="sm" variant="primary" onClick={openCreate}>+ Thêm milestone</Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold">{editItem ? "Sửa milestone" : "Thêm milestone"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm text-muted-foreground font-medium">Tên milestone *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hoàn thành thiết kế" className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Ngày đến hạn *</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground font-medium">Trạng thái</label>
                <SearchSelect
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val })}
                  options={[
                    { value: "upcoming", label: "Sắp tới" },
                    { value: "reached", label: "Đã đạt" },
                    { value: "missed", label: "Trễ hạn" },
                  ]}
                  placeholder="Chọn trạng thái"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button onClick={() => setShowForm(false)}>Hủy</Button>
              <Button variant="primary" onClick={handleSave} disabled={isPending}>
                {isPending ? "Đang lưu..." : editItem ? "Lưu" : "Tạo"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <EmptyState icon={<Diamond size={32} strokeWidth={1.5} />} title="Chưa có milestone" subtitle="Thêm milestone để theo dõi mốc tiến độ" />
      ) : (
        <Section title="">
          <div className="p-4 space-y-3">
            {sorted.map((m: any) => {
              const st = STATUS_COLORS[m.status] || STATUS_COLORS.upcoming;
              return (
                <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: st.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(m.due_date)}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <button onClick={() => openEdit(m)} className="text-sm text-primary hover:underline">Sửa</button>
                  <button onClick={() => handleDelete(m)} className="text-sm text-destructive hover:underline">Xóa</button>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
