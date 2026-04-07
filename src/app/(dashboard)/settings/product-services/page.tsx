"use client";

import { useState } from "react";
import { useProductServices, useCreateProductService, useUpdateProductService, useDeleteProductService } from "@/features/revenue/hooks/use-product-services";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/format";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Package } from "lucide-react";
import type { ProductService, ProductServiceCategory } from "@/lib/types";

const CATEGORIES: { value: ProductServiceCategory; label: string; tKey: keyof any }[] = [
  { value: "design", label: "catDesign", tKey: "catDesign" },
  { value: "consulting", label: "catConsulting", tKey: "catConsulting" },
  { value: "survey", label: "catSurveyPS", tKey: "catSurveyPS" },
  { value: "supervision", label: "catSupervision", tKey: "catSupervision" },
  { value: "other", label: "catOther", tKey: "catOther" },
];

const CAT_COLORS: Record<string, string> = {
  design: "bg-blue-500/10 text-blue-600",
  consulting: "bg-purple-500/10 text-purple-600",
  survey: "bg-amber-500/10 text-amber-600",
  supervision: "bg-green-500/10 text-green-600",
  other: "bg-gray-500/10 text-gray-600",
};

interface FormData {
  code: string;
  name: string;
  category: ProductServiceCategory;
  unit_price: number;
  description: string;
}

const emptyForm: FormData = { code: "", name: "", category: "other", unit_price: 0, description: "" };

export default function ProductServicesPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const { data: res } = useProductServices({ category: filterCategory || undefined, search: search || undefined, is_active: "true" });
  const items = res?.data ?? [];

  const create = useCreateProductService();
  const update = useUpdateProductService();
  const remove = useDeleteProductService();

  const [dialogMode, setDialogMode] = useState<"closed" | "create" | "edit">("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const catLabel = (c: string) => (t.revenue as any)[CATEGORIES.find(x => x.value === c)?.label ?? "catOther"] ?? c;

  const openCreate = () => { setForm(emptyForm); setEditId(null); setDialogMode("create"); };
  const openEdit = (ps: ProductService) => {
    setForm({ code: ps.code, name: ps.name, category: ps.category, unit_price: ps.unit_price, description: ps.description ?? "" });
    setEditId(ps.id);
    setDialogMode("edit");
  };
  const closeDialog = () => setDialogMode("closed");

  const handleSubmit = async () => {
    if (!form.code || !form.name) { toast.error("Nhập mã và tên SP/DV"); return; }
    try {
      if (dialogMode === "create") {
        await create.mutateAsync({ code: form.code, name: form.name, category: form.category, unit_price: form.unit_price, description: form.description || null, is_active: true });
      } else if (editId) {
        await update.mutateAsync({ id: editId, code: form.code, name: form.name, category: form.category, unit_price: form.unit_price, description: form.description || null });
      }
      toast.success(dialogMode === "create" ? "Đã tạo SP/DV" : "Đã cập nhật");
      closeDialog();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeactivate = async (ps: ProductService) => {
    if (!confirm(t.revenue.confirmDeactivate)) return;
    try { await remove.mutateAsync(ps.id); toast.success(t.revenue.psInactive); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">{t.revenue.productServiceTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.revenue.productServiceSub}</p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={openCreate}><Plus size={14} className="mr-1" />{t.revenue.newProductService}</Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.common.search}
          className="h-8 w-56 px-3 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
        <div className="w-36">
          <SearchSelect value={filterCategory} onChange={setFilterCategory}
            options={[{ value: "", label: t.revenue.allDimensions }, ...CATEGORIES.map(c => ({ value: c.value, label: catLabel(c.value) }))]} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Package size={32} strokeWidth={1.5} />} title="Chưa có SP/DV" subtitle={t.revenue.productServiceSub} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.psCode}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.psName}</th>
                <th className="text-left px-4 py-2.5 font-medium">{t.revenue.psCategory}</th>
                <th className="text-right px-4 py-2.5 font-medium">{t.revenue.psUnitPrice}</th>
                {canManage && <th className="text-right px-4 py-2.5 font-medium w-24" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((ps) => (
                <tr key={ps.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium text-primary">{ps.code}</td>
                  <td className="px-4 py-2.5 font-medium">{ps.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CAT_COLORS[ps.category]}`}>{catLabel(ps.category)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatVND(ps.unit_price)}</td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(ps)} className="p-1 rounded hover:bg-secondary"><Pencil size={13} /></button>
                        <button onClick={() => handleDeactivate(ps)} className="p-1 rounded hover:bg-red-500/10 text-destructive"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogMode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeDialog}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">{dialogMode === "create" ? t.revenue.newProductService : "Chỉnh sửa SP/DV"}</h3>
              <button onClick={closeDialog} className="p-1 rounded hover:bg-secondary"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.revenue.psCode} *</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.revenue.psName} *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.revenue.psCategory}</label>
                <SearchSelect value={form.category} onChange={(v) => setForm({ ...form, category: v as ProductServiceCategory })}
                  options={CATEGORIES.map(c => ({ value: c.value, label: catLabel(c.value) }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.revenue.psUnitPrice}</label>
                <input type="number" min={0} value={form.unit_price || ""} onChange={(e) => setForm({ ...form, unit_price: +e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-sm font-mono focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">{t.revenue.description}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button onClick={closeDialog}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={create.isPending || update.isPending}>
                {dialogMode === "create" ? t.revenue.create : t.common.save}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
