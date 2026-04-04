"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useProject, useUpdateProject } from "@/lib/hooks/use-projects";
import { Section, Button } from "@/components/shared";
import { formatDate, formatVND } from "@/lib/utils/kpi";
import { SearchSelect } from "@/components/shared/search-select";
import { toast } from "sonner";

export default function ProjectSettingsPage() {
  const params = useParams();
  const { data: project } = useProject(params.id as string);
  const updateProject = useUpdateProject();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  if (!project) return null;

  const startEdit = () => {
    setForm({
      name: project.name,
      code: project.code,
      description: project.description || "",
      client: project.client || "",
      contract_no: project.contract_no || "",
      location: project.location || "",
      budget: project.budget || 0,
      allocation_fund: project.allocation_fund || 0,
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      status: project.status,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({ id: project.id, ...form });
      toast.success("Cập nhật dự án thành công!");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Lỗi cập nhật");
    }
  };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none";

  if (!editing) {
    const fields = [
      { label: "Mã dự án", value: project.code },
      { label: "Tên dự án", value: project.name },
      { label: "Trạng thái", value: project.status },
      { label: "Khách hàng", value: project.client || "—" },
      { label: "Hợp đồng", value: project.contract_no || "—" },
      { label: "Địa điểm", value: project.location || "—" },
      { label: "Ngân sách", value: project.budget ? formatVND(project.budget) : "—" },
      { label: "Quỹ khoán", value: project.allocation_fund ? formatVND(project.allocation_fund) : "—" },
      { label: "Ngày bắt đầu", value: formatDate(project.start_date) },
      { label: "Ngày kết thúc", value: formatDate(project.end_date) },
      { label: "Ngày tạo", value: formatDate(project.created_at) },
    ];

    return (
      <Section title="Thông tin dự án" action={<Button size="sm" onClick={startEdit}>Chỉnh sửa</Button>}>
        <div className="p-5 space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center py-2 border-b border-border/30">
              <span className="text-sm text-muted-foreground w-40 flex-shrink-0">{f.label}</span>
              <span className="text-base font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Chỉnh sửa dự án">
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Mã dự án</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Tên dự án</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Trạng thái</label>
            <SearchSelect
              value={form.status}
              onChange={(val) => setForm({ ...form, status: val })}
              options={[
                { value: "planning", label: "Lập kế hoạch" },
                { value: "active", label: "Đang triển khai" },
                { value: "paused", label: "Tạm dừng" },
                { value: "completed", label: "Hoàn thành" },
              ]}
              placeholder="Chọn trạng thái"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Khách hàng</label>
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Hợp đồng</label>
            <input value={form.contract_no} onChange={(e) => setForm({ ...form, contract_no: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Địa điểm</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Ngân sách (VNĐ)</label>
            <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Quỹ khoán (VNĐ)</label>
            <input type="number" value={form.allocation_fund} onChange={(e) => setForm({ ...form, allocation_fund: Number(e.target.value) })} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted-foreground font-medium">Ngày bắt đầu</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground font-medium">Ngày kết thúc</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSave} disabled={updateProject.isPending}>
            {updateProject.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
          <Button onClick={() => setEditing(false)}>Hủy</Button>
        </div>
      </div>
    </Section>
  );
}
