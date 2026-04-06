"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAllocationConfig, useAllocationCycle, useUpdateAllocationCycle, kpiKeys } from "@/lib/hooks/use-kpi";
import { useAuthStore } from "@/lib/stores";
import { createClient } from "@/lib/supabase/client";
import { Section, Button } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

/**
 * KPI Configuration page — manage the weight distribution for KPI scoring.
 * Weights control how volume, quality, difficulty, and ahead-of-schedule
 * components contribute to each task's total KPI score.
 */
export default function KPIConfigPage() {
  const { t } = useI18n();
  const { data: config } = useAllocationConfig();
  const { user } = useAuthStore();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const canEdit = user && ["admin", "leader"].includes(user.role);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    weight_volume: config?.weight_volume ?? 0.4,
    weight_quality: config?.weight_quality ?? 0.3,
    weight_difficulty: config?.weight_difficulty ?? 0.2,
    weight_ahead: config?.weight_ahead ?? 0.1,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (config?.id) {
        const { error } = await supabase.from("allocation_configs").update(values).eq("id", config.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single();
        if (!profile) throw new Error("Profile not found");
        const { error } = await supabase.from("allocation_configs").insert({
          org_id: profile.org_id,
          name: "Default Config",
          ...values,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kpiKeys.config() });
      toast.success(config ? "Updated!" : "Created!");
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const weights = [
    { key: "weight_volume", label: t.kpi.volumeLabel, color: "#38bdf8" },
    { key: "weight_quality", label: t.kpi.qualityLabel, color: "#10b981" },
    { key: "weight_difficulty", label: t.kpi.difficultyLabel, color: "#f59e0b" },
    { key: "weight_ahead", label: t.kpi.aheadLabel, color: "#8b5cf6" },
  ];

  const currentValues = editing ? form : (config || form);
  const total = weights.reduce((s, w) => s + Math.round((currentValues[w.key as keyof typeof form] || 0) * 100), 0);

  const handleSave = () => {
    if (Math.abs(total - 100) > 1) {
      toast.error("Total weights must equal 100%");
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="max-w-xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">{config ? t.kpi.currentWeights : t.kpi.createConfig}</h3>
        {!editing && canEdit && (
          <Button variant="primary" onClick={() => { setEditing(true); if (config) setForm({ weight_volume: config.weight_volume, weight_quality: config.weight_quality, weight_difficulty: config.weight_difficulty, weight_ahead: config.weight_ahead }); }}>
            {config ? t.kpi.editConfig : t.kpi.createConfigBtn}
          </Button>
        )}
      </div>

      <Section title={t.kpi.allocationWeights}>
        <div className="p-5 space-y-4">
          {weights.map((w) => {
            const val = currentValues[w.key as keyof typeof form] || 0;
            return (
              <div key={w.key} className="flex items-center gap-4">
                <span className="text-base w-40 font-medium">{w.label}</span>
                {editing ? (
                  <>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={Math.round(val * 100)}
                      onChange={(e) => setForm({ ...form, [w.key]: parseInt(e.target.value) / 100 })}
                      className="flex-1 accent-primary"
                    />
                    <span className="font-mono text-base font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${val * 100}%`, background: w.color }} />
                    </div>
                    <span className="font-mono text-base font-bold w-12 text-right" style={{ color: w.color }}>
                      {Math.round(val * 100)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-base font-semibold">{t.common.total}</span>
            <span className={`font-mono text-base font-bold ${total === 100 ? "text-green-500" : "text-destructive"}`}>
              {total}%
            </span>
          </div>
          {editing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t.common.saving : t.kpi.saveConfig}
              </Button>
            </div>
          )}
        </div>
      </Section>

      {config && (
        <Section title={t.kpi.formula}>
          <div className="p-5">
            <div className="bg-secondary rounded-xl p-4 font-mono text-base leading-relaxed">
              <p className="text-primary font-bold mb-2">KPI Score = Σ(Component × Weight)</p>
              <p className="text-muted-foreground">
                = KL×{Math.round(config.weight_volume * 100)}% + CL×{Math.round(config.weight_quality * 100)}% + ĐK×{Math.round(config.weight_difficulty * 100)}% + VTĐ×{Math.round(config.weight_ahead * 100)}%
              </p>
              <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm text-muted-foreground">
                <p>Variance (Δ) = Actual Score - Expected Score</p>
                <p>Δ ≥ +10 → <span className="text-green-500">{t.kpi.exceptionalFull}</span></p>
                <p>Δ ≥ 0 → <span className="text-blue-500">{t.kpi.exceededFull}</span></p>
                <p>Δ ≥ -10 → <span className="text-amber-500">{t.kpi.nearTargetFull}</span></p>
                <p>Δ &lt; -10 → <span className="text-red-500">{t.kpi.belowTargetFull}</span></p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ─── Cấu hình kỳ khoán ─── */}
      <AllocationCycleSection canEdit={!!canEdit} />
    </div>
  );
}

/** Cấu hình kỳ khoán: chu kỳ 3/6 tháng và tháng bắt đầu */
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

        {/* Preview chu kỳ */}
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
