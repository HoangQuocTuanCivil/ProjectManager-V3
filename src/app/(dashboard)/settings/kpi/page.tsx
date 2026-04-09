"use client";

import { useState } from "react";
import { useAllocationConfig } from "@/features/kpi";
import { useUpdateSetting } from "@/features/settings";
import { useCenters } from "@/features/organization";
import { Section, Button, KPIRing, KPIScoreBar } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { KPI_WEIGHTS, calcKPIScore } from "@/lib/utils/kpi";

export default function KPISettingsPage() {
  const { data: config } = useAllocationConfig();
  const updateSetting = useUpdateSetting();

  const { data: centers = [] } = useCenters();
  const [scopeCenter, setScopeCenter] = useState("all");

  const [weights, setWeights] = useState({
    volume: config?.weight_volume ?? KPI_WEIGHTS.volume,
    quality: config?.weight_quality ?? KPI_WEIGHTS.quality,
    difficulty: config?.weight_difficulty ?? KPI_WEIGHTS.difficulty,
    ahead: config?.weight_ahead ?? KPI_WEIGHTS.ahead,
  });

  /* KL + CL + ĐK = 100% (cơ bản). VTĐ là bonus thêm, không tính vào tổng cơ bản. */
  const baseTotal = Math.round((weights.volume + weights.quality + weights.difficulty) * 100);
  const bonusPercent = Math.round(weights.ahead * 100);
  const isValid = baseTotal === 100;

  // Example score calculation
  const exampleE = calcKPIScore(100, 80, 60, 50);
  const exampleA = calcKPIScore(100, 85, 70, 60);

  const weightItems = [
    { key: "volume" as const, label: "Khối lượng (KL)", color: "#38bdf8", desc: "Số lượng công việc hoàn thành, mặc định = 100" },
    { key: "quality" as const, label: "Chất lượng (CL)", color: "#10b981", desc: "Đánh giá chất lượng sản phẩm đầu ra" },
    { key: "difficulty" as const, label: "Độ khó (ĐK)", color: "#f59e0b", desc: "Mức độ phức tạp, kỹ thuật của công việc" },
    { key: "ahead" as const, label: "Vượt tiến độ (VTĐ) — Bonus", color: "#8b5cf6", desc: "Đúng hạn = 100%. Vượt hạn = thưởng thêm tối đa điểm bonus" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Cấu hình KPI</h2>
        <p className="text-base text-muted-foreground mt-0.5">Thiết lập trọng số và công thức tính KPI</p>
      </div>

      {/* Phạm vi áp dụng */}
      <Section title="Phạm vi áp dụng">
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-3">Cấu hình KPI áp dụng cho trung tâm cụ thể hoặc toàn công ty</p>
          <SearchSelect
            value={scopeCenter}
            onChange={setScopeCenter}
            options={[
              { value: "all", label: "Toàn công ty (mặc định)" },
              ...(centers as any[]).map((c: any) => ({ value: c.id, label: c.code ? `${c.code} — ${c.name}` : c.name })),
            ]}
            placeholder="Chọn trung tâm..."
            className="w-72"
          />
        </div>
      </Section>

      {/* Weights */}
      <Section title="Trọng số KPI">
        <div className="p-5 space-y-5">
          {weightItems.map((w) => (
            <div key={w.key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-base font-semibold">{w.label}</span>
                  <p className="text-[11px] text-muted-foreground">{w.desc}</p>
                </div>
                <span className="font-mono text-lg font-bold" style={{ color: w.color }}>
                  {Math.round(weights[w.key] * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0" max="100" step="5"
                value={Math.round(weights[w.key] * 100)}
                onChange={(e) => setWeights({ ...weights, [w.key]: +e.target.value / 100 })}
                className="w-full accent-current"
                style={{ color: w.color } as any}
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-base font-bold">Trọng số cơ bản</span>
              <span className="text-xs text-muted-foreground ml-2">(KL + CL + ĐK)</span>
            </div>
            <span className={`font-mono text-lg font-bold ${isValid ? "text-green-500" : "text-destructive"}`}>
              {baseTotal}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Bonus vượt tiến độ</span>
            </div>
            <span className="font-mono text-sm font-bold text-purple-500">+{bonusPercent}%</span>
          </div>

          {!isValid && (
            <p className="text-sm text-destructive">Tổng trọng số cơ bản (KL + CL + ĐK) phải bằng 100%. Hiện tại: {baseTotal}%</p>
          )}
        </div>
      </Section>

      {/* Formula */}
      <Section title="Công thức tính">
        <div className="p-5">
          <div className="bg-secondary rounded-xl p-4 font-mono text-base">
            <p className="text-primary font-bold mb-2">KPI Score = KL×{Math.round(weights.volume * 100)}% + CL×{Math.round(weights.quality * 100)}% + ĐK×{Math.round(weights.difficulty * 100)}% + VTĐ×{Math.round(weights.ahead * 100)}%</p>
            <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm text-muted-foreground">
              <p><span className="text-foreground font-semibold">Variance (Δ)</span> = Actual Score - Expected Score</p>
              <p>Δ ≥ +10 → <span className="text-green-500 font-semibold">Đặc biệt xuất sắc</span></p>
              <p>0 ≤ Δ &lt; 10 → <span className="text-blue-500 font-semibold">Vượt kỳ vọng</span></p>
              <p>-10 ≤ Δ &lt; 0 → <span className="text-amber-500 font-semibold">Gần đạt</span></p>
              <p>Δ &lt; -10 → <span className="text-red-500 font-semibold">Dưới kỳ vọng</span></p>
            </div>
          </div>
        </div>
      </Section>

      {/* Example */}
      <Section title="Ví dụ minh họa">
        <div className="p-5 grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-bold text-primary uppercase mb-3">Kỳ vọng (E)</p>
            <div className="flex items-center gap-3 mb-3">
              <KPIRing score={exampleE} size={56} strokeWidth={4} />
              <span className="font-mono text-xl font-bold text-primary">{exampleE}</span>
            </div>
            <div className="space-y-1.5">
              <KPIScoreBar label="KL" value={100} color="#38bdf8" weight={`${Math.round(weights.volume * 100)}%`} />
              <KPIScoreBar label="CL" value={80} color="#10b981" weight={`${Math.round(weights.quality * 100)}%`} />
              <KPIScoreBar label="ĐK" value={60} color="#f59e0b" weight={`${Math.round(weights.difficulty * 100)}%`} />
              <KPIScoreBar label="VTĐ" value={50} color="#8b5cf6" weight={`${Math.round(weights.ahead * 100)}%`} />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-green-500 uppercase mb-3">Thực tế (A)</p>
            <div className="flex items-center gap-3 mb-3">
              <KPIRing score={exampleA} size={56} strokeWidth={4} />
              <div>
                <span className="font-mono text-xl font-bold text-green-500">{exampleA}</span>
                <span className="font-mono text-base ml-2" style={{ color: exampleA >= exampleE ? "#10b981" : "#ef4444" }}>
                  ({exampleA >= exampleE ? "+" : ""}{exampleA - exampleE})
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <KPIScoreBar label="KL" value={100} color="#38bdf8" weight={`${Math.round(weights.volume * 100)}%`} />
              <KPIScoreBar label="CL" value={85} color="#10b981" weight={`${Math.round(weights.quality * 100)}%`} />
              <KPIScoreBar label="ĐK" value={70} color="#f59e0b" weight={`${Math.round(weights.difficulty * 100)}%`} />
              <KPIScoreBar label="VTĐ" value={60} color="#8b5cf6" weight={`${Math.round(weights.ahead * 100)}%`} />
            </div>
          </div>
        </div>
      </Section>

      {/* Allocation formula */}
      <Section title="Công thức chia khoán">
        <div className="p-5">
          <div className="bg-secondary rounded-xl p-4 font-mono text-base space-y-2">
            <p className="text-amber-500 font-bold">Phân bổ khoán = (Điểm KPI cá nhân / Tổng điểm KPI) × Quỹ khoán</p>
            <p className="text-sm text-muted-foreground mt-2">
              Trong đó điểm KPI cá nhân = trung bình có trọng số (kpi_weight) của actual_score các task đã nghiệm thu
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
