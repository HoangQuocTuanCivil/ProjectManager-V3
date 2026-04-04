"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Section, Button, EmptyState, KPIRing } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { PRIORITY_CONFIG } from "@/lib/utils/kpi";
import type { TaskTemplate, TaskPriority, TaskType } from "@/lib/types";
import { toast } from "sonner";

const supabase = createClient();

const defaultForm = {
  name: "",
  category: "",
  default_title: "",
  default_priority: "medium" as TaskPriority,
  default_type: "task" as TaskType,
  default_kpi_weight: 5,
  default_estimate_hours: "",
  default_expect_quality: 80,
  default_expect_difficulty: 50,
  default_tags: "",
};

export default function TemplatesSettingsPage() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_templates").select("*").order("category", { ascending: true });
      if (error) throw error;
      return data as TaskTemplate[];
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTpl, setEditTpl] = useState<TaskTemplate | null>(null);

  const createMutation = useMutation({
    mutationFn: async (form: typeof defaultForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
      if (!profile) throw new Error("Không tìm thấy profile");

      const { data, error } = await supabase.from("task_templates").insert({
        org_id: profile.org_id,
        name: form.name,
        category: form.category || null,
        default_title: form.default_title || null,
        default_priority: form.default_priority,
        default_type: form.default_type,
        default_kpi_weight: form.default_kpi_weight,
        default_estimate_hours: form.default_estimate_hours ? parseFloat(form.default_estimate_hours) : null,
        default_expect_quality: form.default_expect_quality,
        default_expect_difficulty: form.default_expect_difficulty,
        default_tags: form.default_tags ? form.default_tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Tạo mẫu thành công!");
      setShowCreate(false);
    },
    onError: (e: any) => toast.error(e.message || "Lỗi tạo mẫu"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from("task_templates").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Cập nhật thành công!");
      setEditTpl(null);
    },
    onError: (e: any) => toast.error(e.message || "Lỗi cập nhật"),
  });

  const groups = templates.reduce((acc: Record<string, TaskTemplate[]>, t) => {
    const cat = t.category || "Chung";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mẫu công việc</h2>
          <p className="text-base text-muted-foreground mt-0.5">{templates.length} mẫu có sẵn</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ Tạo mẫu</Button>
      </div>

      {showCreate && (
        <TemplateFormModal
          title="Tạo mẫu công việc"
          initialForm={defaultForm}
          onClose={() => setShowCreate(false)}
          onSave={(form) => createMutation.mutate(form)}
          isPending={createMutation.isPending}
        />
      )}

      {editTpl && (
        <TemplateFormModal
          title={`Sửa mẫu: ${editTpl.name}`}
          initialForm={{
            name: editTpl.name,
            category: editTpl.category || "",
            default_title: editTpl.default_title || "",
            default_priority: editTpl.default_priority,
            default_type: editTpl.default_type,
            default_kpi_weight: editTpl.default_kpi_weight,
            default_estimate_hours: editTpl.default_estimate_hours?.toString() || "",
            default_expect_quality: editTpl.default_expect_quality,
            default_expect_difficulty: editTpl.default_expect_difficulty,
            default_tags: editTpl.default_tags?.join(", ") || "",
          }}
          onClose={() => setEditTpl(null)}
          onSave={(form) => updateMutation.mutate({
            id: editTpl.id,
            name: form.name,
            category: form.category || null,
            default_title: form.default_title || null,
            default_priority: form.default_priority,
            default_type: form.default_type,
            default_kpi_weight: form.default_kpi_weight,
            default_estimate_hours: form.default_estimate_hours ? parseFloat(form.default_estimate_hours) : null,
            default_expect_quality: form.default_expect_quality,
            default_expect_difficulty: form.default_expect_difficulty,
            default_tags: form.default_tags ? form.default_tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          })}
          isPending={updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <EmptyState icon="📄" title="Chưa có mẫu công việc" subtitle="Tạo mẫu để tái sử dụng khi giao việc" />
      ) : (
        Object.entries(groups).map(([category, items]) => (
          <Section key={category} title={`${category} (${items.length})`}>
            <div className="divide-y divide-border/40">
              {items.map((t) => {
                const priCfg = PRIORITY_CONFIG[t.default_priority];
                return (
                  <div key={t.id} className="px-4 py-3 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold">{t.name}</p>
                      {t.default_title && <p className="text-xs text-muted-foreground mt-0.5">{t.default_title}</p>}
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-secondary">{t.default_type === "product" ? "Sản phẩm" : "Task"}</span>
                        <span style={{ color: priCfg.color }}>{priCfg.icon} {priCfg.label}</span>
                        <span className="text-muted-foreground">W:{t.default_kpi_weight}</span>
                        {t.default_estimate_hours && <span className="text-muted-foreground">{t.default_estimate_hours}h</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <KPIRing score={t.default_expect_quality} size={28} strokeWidth={2} />
                        <p className="text-[8px] text-muted-foreground">CL</p>
                      </div>
                      <div className="text-center">
                        <KPIRing score={t.default_expect_difficulty} size={28} strokeWidth={2} />
                        <p className="text-[8px] text-muted-foreground">ĐK</p>
                      </div>
                    </div>
                    {t.default_tags && t.default_tags.length > 0 && (
                      <div className="flex gap-1">
                        {t.default_tags.map((tag) => (
                          <span key={tag} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setEditTpl(t)} className="text-sm text-primary hover:underline flex-shrink-0">Sửa</button>
                  </div>
                );
              })}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}

function TemplateFormModal({ title, initialForm, onClose, onSave, isPending }: {
  title: string;
  initialForm: typeof defaultForm;
  onClose: () => void;
  onSave: (form: typeof defaultForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initialForm);

  const handleSave = () => {
    if (!form.name) { toast.error("Vui lòng nhập tên mẫu"); return; }
    onSave(form);
  };

  const inputClass = "mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";
  const labelClass = "text-sm text-muted-foreground font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg p-1 rounded focus-ring" aria-label="Đóng">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tên mẫu *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Thiết kế bản vẽ" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Danh mục</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="BIM, Giám sát..." className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tiêu đề mặc định</label>
            <input value={form.default_title} onChange={(e) => setForm({ ...form, default_title: e.target.value })} placeholder="Tiêu đề tự động điền khi tạo task" className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Loại</label>
              <SearchSelect
                value={form.default_type}
                onChange={(val) => setForm({ ...form, default_type: val as TaskType })}
                options={[
                  { value: "task", label: "Task" },
                  { value: "product", label: "Sản phẩm" },
                ]}
                placeholder="Chọn loại"
                className="mt-1"
              />
            </div>
            <div>
              <label className={labelClass}>Độ ưu tiên</label>
              <SearchSelect
                value={form.default_priority}
                onChange={(val) => setForm({ ...form, default_priority: val as TaskPriority })}
                options={[
                  { value: "low", label: "Thấp" },
                  { value: "medium", label: "Trung bình" },
                  { value: "high", label: "Cao" },
                  { value: "urgent", label: "Khẩn cấp" },
                ]}
                placeholder="Chọn độ ưu tiên"
                className="mt-1"
              />
            </div>
            <div>
              <label className={labelClass}>Giờ ước lượng</label>
              <input type="number" value={form.default_estimate_hours} onChange={(e) => setForm({ ...form, default_estimate_hours: e.target.value })} placeholder="8" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Trọng số KPI (1-10)</label>
              <input type="number" min={1} max={10} value={form.default_kpi_weight} onChange={(e) => setForm({ ...form, default_kpi_weight: parseInt(e.target.value) || 5 })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CL kỳ vọng (%)</label>
              <input type="number" min={0} max={100} value={form.default_expect_quality} onChange={(e) => setForm({ ...form, default_expect_quality: parseInt(e.target.value) || 80 })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Độ khó (%)</label>
              <input type="number" min={0} max={100} value={form.default_expect_difficulty} onChange={(e) => setForm({ ...form, default_expect_difficulty: parseInt(e.target.value) || 50 })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tags (cách nhau bằng dấu phẩy)</label>
            <input value={form.default_tags} onChange={(e) => setForm({ ...form, default_tags: e.target.value })} placeholder="BIM, Revit, 3D..." className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
