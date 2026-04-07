"use client";

import { useState } from "react";
import { useProductServices, useCreateProductService, useUpdateProductService, useDeleteProductService } from "@/features/revenue/hooks/use-product-services";
import { usePSCategories, useCreatePSCategory, useUpdatePSCategory, useDeletePSCategory } from "@/features/revenue/hooks/use-ps-categories";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores";
import { Button, EmptyState } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { formatVND } from "@/lib/utils/format";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Package, Check, Settings2 } from "lucide-react";
import type { ProductService, PSCategory } from "@/lib/types";

const COLOR_PRESETS = [
  { value: "bg-blue-500/10 text-blue-600", label: "Xanh dương" },
  { value: "bg-purple-500/10 text-purple-600", label: "Tím" },
  { value: "bg-amber-500/10 text-amber-600", label: "Cam" },
  { value: "bg-green-500/10 text-green-600", label: "Xanh lá" },
  { value: "bg-red-500/10 text-red-600", label: "Đỏ" },
  { value: "bg-pink-500/10 text-pink-600", label: "Hồng" },
  { value: "bg-cyan-500/10 text-cyan-600", label: "Cyan" },
  { value: "bg-gray-500/10 text-gray-600", label: "Xám" },
];

interface FormData {
  code: string;
  name: string;
  category: string;
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

  const { data: categories = [] } = usePSCategories();

  const create = useCreateProductService();
  const update = useUpdateProductService();
  const remove = useDeleteProductService();

  const [dialogMode, setDialogMode] = useState<"closed" | "create" | "edit">("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const [showCatManager, setShowCatManager] = useState(false);

  const catMap = new Map(categories.map((c) => [c.slug, c]));
  const catLabel = (slug: string) => catMap.get(slug)?.name ?? slug;
  const catColor = (slug: string) => catMap.get(slug)?.color ?? "bg-gray-500/10 text-gray-600";

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
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button onClick={() => setShowCatManager(true)}>
                <Settings2 size={14} className="mr-1" />Phân loại
              </Button>
              <Button variant="primary" onClick={openCreate}>
                <Plus size={14} className="mr-1" />{t.revenue.newProductService}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.common.search}
          className="h-8 w-56 px-3 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
        <div className="w-36">
          <SearchSelect value={filterCategory} onChange={setFilterCategory}
            options={[{ value: "", label: "Tất cả" }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]} />
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
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColor(ps.category)}`}>{catLabel(ps.category)}</span>
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

      {/* Dialog SP/DV */}
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
                <SearchSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                  options={categories.map((c) => ({ value: c.slug, label: c.name }))} className="mt-1" />
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

      {/* Category Manager Modal */}
      {showCatManager && <CategoryManager categories={categories} onClose={() => setShowCatManager(false)} />}
    </div>
  );
}

function CategoryManager({ categories, onClose }: { categories: PSCategory[]; onClose: () => void }) {
  const createCat = useCreatePSCategory();
  const updateCat = useUpdatePSCategory();
  const deleteCat = useDeletePSCategory();

  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("bg-gray-500/10 text-gray-600");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = async () => {
    if (!newSlug || !newName) { toast.error("Nhập mã và tên phân loại"); return; }
    try {
      await createCat.mutateAsync({ slug: newSlug, name: newName, color: newColor });
      toast.success("Đã tạo phân loại");
      setNewSlug("");
      setNewName("");
      setNewColor("bg-gray-500/10 text-gray-600");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateCat.mutateAsync({ id, name: editName, color: editColor });
      toast.success("Đã cập nhật");
      setEditingId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (cat: PSCategory) => {
    if (!confirm(`Xóa phân loại "${cat.name}"?`)) return;
    try {
      await deleteCat.mutateAsync(cat.id);
      toast.success("Đã xóa phân loại");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-bold">Quản lý phân loại SP/DV</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Existing categories */}
          <div className="space-y-1.5">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 py-1.5">
                {editingId === cat.id ? (
                  <>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
                    <select value={editColor} onChange={(e) => setEditColor(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none">
                      {COLOR_PRESETS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <button onClick={() => handleUpdate(cat.id)} className="p-1 rounded hover:bg-green-500/10 text-green-600"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-secondary"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{cat.slug}</span>
                    <span className="flex-1" />
                    <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color || ""); }}
                      className="p-1 rounded hover:bg-secondary"><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(cat)} className="p-1 rounded hover:bg-red-500/10 text-destructive"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new category */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Thêm phân loại mới</p>
            <div className="flex items-center gap-2">
              <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Mã (VD: testing)"
                className="w-28 h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên phân loại"
                className="flex-1 h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none" />
              <select value={newColor} onChange={(e) => setNewColor(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none">
                {COLOR_PRESETS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <Button variant="primary" onClick={handleCreate} disabled={createCat.isPending}>
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
