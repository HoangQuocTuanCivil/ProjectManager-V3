"use client";

import { useState, useMemo, useCallback } from "react";
import { useAuthStore } from "@/lib/stores";
import { useModuleAccessAll, useSaveModuleAccess, ALL_MODULES } from "@/features/settings/hooks/use-module-access";
import { Section, Button, EmptyState } from "@/components/shared";
import { Shield, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function useCenters() {
  return useQuery({
    queryKey: ["centers"],
    queryFn: async () => {
      const { data } = await supabase.from("centers").select("id, name, code").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });
}

/** Trang cấu hình phân quyền module theo trung tâm — chỉ Admin truy cập */
export default function ModuleAccessPage() {
  const { user } = useAuthStore();
  const { data: centers = [] } = useCenters();
  const { data: items = [], isLoading } = useModuleAccessAll();
  const save = useSaveModuleAccess();

  // State local: map "center::moduleKey" → is_enabled
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());

  // Tạo lookup từ dữ liệu server: key = "targetType:targetId:moduleKey"
  const serverMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of items) {
      map.set(`${item.target_type}:${item.target_id}:${item.module_key}`, item.is_enabled);
    }
    return map;
  }, [items]);

  // Giá trị hiện tại: ưu tiên changes local, fallback server, mặc định true (mở)
  const getValue = useCallback((targetType: string, targetId: string, moduleKey: string): boolean => {
    const key = `${targetType}:${targetId}:${moduleKey}`;
    if (changes.has(key)) return changes.get(key)!;
    if (serverMap.has(key)) return serverMap.get(key)!;
    return true;
  }, [changes, serverMap]);

  const toggle = (targetType: string, targetId: string, moduleKey: string) => {
    const key = `${targetType}:${targetId}:${moduleKey}`;
    const current = getValue(targetType, targetId, moduleKey);
    setChanges((prev) => new Map(prev).set(key, !current));
  };

  const handleSave = async () => {
    if (changes.size === 0) return;
    const batch = Array.from(changes.entries()).map(([key, is_enabled]) => {
      const [target_type, target_id, module_key] = key.split(":");
      return { target_type: target_type as "center" | "dept", target_id, module_key, is_enabled };
    });
    try {
      await save.mutateAsync(batch);
      setChanges(new Map());
      toast.success("Đã lưu phân quyền module");
    } catch (e: any) {
      toast.error(e.message || "Lỗi lưu");
    }
  };

  if (!user || user.role !== "admin") {
    return <EmptyState icon={<Shield size={32} strokeWidth={1.5} />} title="Không có quyền" subtitle="Chỉ Admin mới có quyền cấu hình phân quyền module" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Phân quyền truy cập module">
        <p className="text-sm text-muted-foreground -mt-2 mb-4">Cấu hình module nào hiển thị cho từng trung tâm. Admin/Leader/Director luôn thấy tất cả.</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Đang tải...</p>
        ) : centers.length === 0 ? (
          <EmptyState icon={<Shield size={32} strokeWidth={1.5} />} title="Chưa có trung tâm" subtitle="Tạo trung tâm trong phần Cài đặt > Trung tâm" />
        ) : (
          <>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-semibold text-foreground min-w-[180px] sticky left-0 bg-secondary/30">Trung tâm</th>
                    {ALL_MODULES.map((m) => (
                      <th key={m.key} className="px-3 py-3 font-medium text-center text-muted-foreground min-w-[90px]">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {centers.map((center) => (
                    <tr key={center.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3 font-medium sticky left-0 bg-card">
                        <span className="text-muted-foreground text-xs mr-1.5">{center.code}</span>
                        {center.name}
                      </td>
                      {ALL_MODULES.map((m) => {
                        const enabled = getValue("center", center.id, m.key);
                        const key = `center:${center.id}:${m.key}`;
                        const hasChange = changes.has(key);
                        return (
                          <td key={m.key} className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggle("center", center.id, m.key)}
                              className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors ${
                                enabled
                                  ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                                  : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              } ${hasChange ? "ring-2 ring-primary/50" : ""}`}
                              title={enabled ? "Cho phép" : "Ẩn"}
                            >
                              {enabled ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thanh lưu */}
            {changes.size > 0 && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {changes.size} thay đổi chưa lưu
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setChanges(new Map())}>Hủy</Button>
                  <Button variant="primary" onClick={handleSave} disabled={save.isPending}>
                    {save.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              <strong>Lưu ý:</strong> Tài khoản có role Admin, Leader, Director không bị ảnh hưởng — luôn thấy tất cả module.
              Cấu hình này chỉ áp dụng cho Head, Team Leader và Staff thuộc trung tâm tương ứng.
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
