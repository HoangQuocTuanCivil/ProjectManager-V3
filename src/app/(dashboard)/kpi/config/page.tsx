"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAllocationConfigs, useAllocationConfig, useAllocationCycle, useUpdateAllocationCycle, kpiKeys } from "@/features/kpi";
import { useCenters } from "@/features/organization";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { Section, Button, ConfirmDialog } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const WEIGHT_KEYS = ["weight_volume", "weight_quality", "weight_difficulty", "weight_ahead"] as const;
type WeightForm = Record<(typeof WEIGHT_KEYS)[number], number>;

export default function KPIConfigPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const canEdit = !!user && ["admin", "leader"].includes(user.role);
  const { data: allConfigs = [] } = useAllocationConfigs();
  const { data: centers = [] } = useCenters();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const centersWithoutConfig = useMemo(() => {
    const usedCenterIds = new Set(allConfigs.filter((c) => c.center_id).map((c) => c.center_id));
    return centers.filter((c: any) => !usedCenterIds.has(c.id));
  }, [allConfigs, centers]);

  const hasCompanyDefault = allConfigs.some((c) => !c.center_id);

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">{t.kpi.currentWeights}</h3>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5">
            <Plus size={14} /> Thêm cấu hình
          </Button>
        )}
      </div>

      {allConfigs.length === 0 && !showAdd && (
        <Section title="Chưa có cấu hình">
          <div className="p-5 text-sm text-muted-foreground">
            Chưa có cấu hình KPI nào. Bấm "Thêm cấu hình" để tạo mới.
          </div>
        </Section>
      )}

      {allConfigs.map((cfg) => (
        <ConfigCard
          key={cfg.id}
          config={cfg}
          label={cfg.center ? `${cfg.center.code || ""} — ${cfg.center.name}` : "Toàn công ty (mặc định)"}
          canEdit={canEdit}
          isEditing={editingId === cfg.id}
          onEdit={() => setEditingId(cfg.id)}
          onCancel={() => setEditingId(null)}
        />
      ))}

      {showAdd && (
        <AddConfigCard
          centersWithoutConfig={centersWithoutConfig}
          hasCompanyDefault={hasCompanyDefault}
          onClose={() => setShowAdd(false)}
        />
      )}

      <AllocationCycleSection canEdit={canEdit} />
    </div>
  );
}

function ConfigCard({ config, label, canEdit, isEditing, onEdit, onCancel }: {
  config: any;
  label: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WeightForm>({
    weight_volume: config.weight_volume,
    weight_quality: config.weight_quality,
    weight_difficulty: config.weight_difficulty,
    weight_ahead: config.weight_ahead,
  });
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        weight_volume: config.weight_volume,
        weight_quality: config.weight_quality,
        weight_difficulty: config.weight_difficulty,
        weight_ahead: config.weight_ahead,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (values: WeightForm) => {
      const { error } = await supabase.from("allocation_configs").update(values).eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.configs() });
      queryClient.invalidateQueries({ queryKey: kpiKeys.config(config.center_id) });
      toast.success("Đã lưu cấu hình!");
      onCancel();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allocation_configs").delete().eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.configs() });
      toast.success("Đã xóa cấu hình!");
      setShowDelete(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const weights = [
    { key: "weight_volume" as const, label: t.kpi.volumeLabel, short: "KL", color: "#38bdf8" },
    { key: "weight_quality" as const, label: t.kpi.qualityLabel, short: "CL", color: "#10b981" },
    { key: "weight_difficulty" as const, label: t.kpi.difficultyLabel, short: "ĐK", color: "#f59e0b" },
    { key: "weight_ahead" as const, label: t.kpi.aheadLabel, short: "VTĐ", color: "#8b5cf6" },
  ];

  const vals = isEditing ? form : config;
  const total = WEIGHT_KEYS.reduce((s, k) => s + Math.round((vals[k] || 0) * 100), 0);

  return (
    <>
      <Section title={label}>
        <div className="p-5 space-y-4">
          {weights.map((w) => {
            const val = vals[w.key] || 0;
            return (
              <div key={w.key} className="flex items-center gap-4">
                <span className="text-sm w-40 font-medium">{w.label}</span>
                {isEditing ? (
                  <>
                    <input type="range" min={0} max={100} step={5}
                      value={Math.round(val * 100)}
                      onChange={(e) => setForm({ ...form, [w.key]: parseInt(e.target.value) / 100 })}
                      className="flex-1 accent-primary" />
                    <span className="font-mono text-sm font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(val * 100, 100)}%`, background: w.color }} />
                    </div>
                    <span className="font-mono text-sm font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-semibold">{t.common.total}</span>
            <span className={`font-mono text-sm font-bold ${total >= 100 ? "text-green-500" : "text-amber-500"}`}>
              {total}%
            </span>
          </div>
          {!isEditing && (
            <div className="font-mono text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
              KPI = {weights.map((w) => `${w.short}×${Math.round((vals[w.key] || 0) * 100)}%`).join(" + ")}
            </div>
          )}
          {canEdit && (
            <div className="flex justify-end gap-2 pt-1">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={onCancel}>{t.common.cancel}</Button>
                  <Button size="sm" variant="primary" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? t.common.saving : t.kpi.saveConfig}
                  </Button>
                </>
              ) : (
                <>
                  <button onClick={onEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Pencil size={12} /> Sửa
                  </button>
                  {config.center_id && (
                    <button onClick={() => setShowDelete(true)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <Trash2 size={12} /> Xóa
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={`Xóa cấu hình "${label}"?`}
        description="Trung tâm này sẽ sử dụng cấu hình mặc định toàn công ty."
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

function AddConfigCard({ centersWithoutConfig, hasCompanyDefault, onClose }: {
  centersWithoutConfig: any[];
  hasCompanyDefault: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [centerId, setCenterId] = useState<string>("");
  const [form, setForm] = useState<WeightForm>({
    weight_volume: 0.4, weight_quality: 0.3, weight_difficulty: 0.2, weight_ahead: 0.1,
  });

  const options = [
    ...(!hasCompanyDefault ? [{ value: "", label: "Toàn công ty (mặc định)" }] : []),
    ...centersWithoutConfig.map((c: any) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` })),
  ];

  useEffect(() => {
    if (options.length > 0 && !options.find((o) => o.value === centerId)) {
      setCenterId(options[0].value);
    }
  }, [options]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
      if (!profile) throw new Error("Profile not found");
      const { error } = await supabase.from("allocation_configs").insert({
        org_id: profile.org_id,
        name: centerId ? `Config center` : "Cấu hình mặc định",
        center_id: centerId || null,
        ...form,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.configs() });
      toast.success("Đã tạo cấu hình!");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const weights = [
    { key: "weight_volume" as const, label: t.kpi.volumeLabel, color: "#38bdf8" },
    { key: "weight_quality" as const, label: t.kpi.qualityLabel, color: "#10b981" },
    { key: "weight_difficulty" as const, label: t.kpi.difficultyLabel, color: "#f59e0b" },
    { key: "weight_ahead" as const, label: t.kpi.aheadLabel, color: "#8b5cf6" },
  ];

  const total = WEIGHT_KEYS.reduce((s, k) => s + Math.round((form[k] || 0) * 100), 0);

  if (options.length === 0) {
    return (
      <Section title="Thêm cấu hình">
        <div className="p-5 text-sm text-muted-foreground">
          Tất cả trung tâm đã có cấu hình riêng.
          <div className="flex justify-end pt-3">
            <Button size="sm" onClick={onClose}>Đóng</Button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Thêm cấu hình mới">
      <div className="p-5 space-y-4">
        <div className="w-64">
          <label className="text-xs text-muted-foreground font-medium">Áp dụng cho</label>
          <SearchSelect value={centerId} onChange={setCenterId} options={options} className="mt-1" />
        </div>

        {weights.map((w) => (
          <div key={w.key} className="flex items-center gap-4">
            <span className="text-sm w-40 font-medium">{w.label}</span>
            <input type="range" min={0} max={100} step={5}
              value={Math.round(form[w.key] * 100)}
              onChange={(e) => setForm({ ...form, [w.key]: parseInt(e.target.value) / 100 })}
              className="flex-1 accent-primary" />
            <span className="font-mono text-sm font-bold w-12 text-right" style={{ color: w.color }}>
              {Math.round(form[w.key] * 100)}%
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm font-semibold">{t.common.total}</span>
          <span className={`font-mono text-sm font-bold ${total >= 100 ? "text-green-500" : "text-amber-500"}`}>
            {total}%
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" onClick={onClose}>{t.common.cancel}</Button>
          <Button size="sm" variant="primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? t.common.saving : "Tạo cấu hình"}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function AllocationCycleSection({ canEdit }: { canEdit: boolean }) {
  const { data: cycle } = useAllocationCycle();
  const updateCycle = useUpdateAllocationCycle();
  const [cycleForm, setCycleForm] = useState({ cycle_months: 3, start_month: 1 });
  const [cycleEditing, setCycleEditing] = useState(false);

  useEffect(() => {
    if (cycle) setCycleForm({ cycle_months: cycle.cycle_months, start_month: cycle.start_month });
  }, [cycle]);

  const monthNames = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

  const handleSaveCycle = () => {
    updateCycle.mutate(cycleForm, {
      onSuccess: () => { toast.success("Lưu cấu hình kỳ khoán!"); setCycleEditing(false); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Section title="Cấu hình kỳ khoán">
      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Chu kỳ khoán xác định khoảng thời gian tính sản lượng vs lương.
          Cuối mỗi kỳ, hệ thống so sánh sản lượng thực tế với tổng lương đã ứng.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium">Chu kỳ</label>
            {cycleEditing ? (
              <SearchSelect value={String(cycleForm.cycle_months)} onChange={(v) => setCycleForm({ ...cycleForm, cycle_months: +v })}
                options={[{ value: "3", label: "3 tháng (Quý)" }, { value: "6", label: "6 tháng (Nửa năm)" }]}
                className="mt-1" />
            ) : (
              <p className="mt-1 text-base font-bold">{cycle?.cycle_months ?? 3} tháng</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Tháng bắt đầu</label>
            {cycleEditing ? (
              <SearchSelect value={String(cycleForm.start_month)} onChange={(v) => setCycleForm({ ...cycleForm, start_month: +v })}
                options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
                className="mt-1" />
            ) : (
              <p className="mt-1 text-base font-bold">{monthNames[(cycle?.start_month ?? 1) - 1]}</p>
            )}
          </div>
        </div>

        {!cycleEditing && cycle && (
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 12 / cycle.cycle_months }, (_, i) => {
              const start = ((cycle.start_month - 1 + i * cycle.cycle_months) % 12) + 1;
              const end = ((start - 1 + cycle.cycle_months - 1) % 12) + 1;
              return (
                <span key={i} className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  Kỳ {i + 1}: {monthNames[start - 1]} → {monthNames[end - 1]}
                </span>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end gap-2 pt-2">
            {cycleEditing ? (
              <>
                <Button onClick={() => setCycleEditing(false)}>Huỷ</Button>
                <Button variant="primary" onClick={handleSaveCycle} disabled={updateCycle.isPending}>
                  {updateCycle.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => setCycleEditing(true)}>Chỉnh sửa</Button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
