"use client";

import { calcKPIScore } from "@/lib/utils/kpi";

interface TaskFormKPIProps {
  kpiWeight: number;
  expectVolume: number;
  expectQuality: number;
  expectDifficulty: number;
  expectAhead: number;
  onUpdate: (key: string, val: number) => void;
}

export function TaskFormKPI({
  kpiWeight,
  expectVolume,
  expectQuality,
  expectDifficulty,
  expectAhead,
  onUpdate,
}: TaskFormKPIProps) {
  const expectScore = calcKPIScore(expectVolume, expectQuality, expectDifficulty, expectAhead);

  return (
    <div className="border-2 border-primary/30 rounded-xl p-4 bg-primary/5">
      <h3 className="text-base font-bold text-primary mb-3">KPI kỳ vọng (nhập khi giao việc)</h3>

      <div className="space-y-3">
        {/* KPI Weight */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-24">Trọng số (W)</label>
          <input
            type="range" min="1" max="10" value={kpiWeight}
            onChange={(e) => onUpdate("kpi_weight", +e.target.value)}
            className="flex-1 accent-primary"
          />
          <span className="font-mono text-base font-bold text-primary w-8 text-right">{kpiWeight}/10</span>
        </div>

        {/* KL */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-24">Khối lượng (40%)</label>
          <input
            type="range" min="0" max="100" step="5" value={expectVolume}
            onChange={(e) => onUpdate("expect_volume", +e.target.value)}
            className="flex-1 accent-sky-400"
          />
          <span className="font-mono text-sm text-sky-400 w-8 text-right">{expectVolume}</span>
        </div>

        {/* CL */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-24">Chất lượng (30%)</label>
          <input
            type="range" min="0" max="100" step="5" value={expectQuality}
            onChange={(e) => onUpdate("expect_quality", +e.target.value)}
            className="flex-1 accent-green-400"
          />
          <span className="font-mono text-sm text-green-400 w-8 text-right">{expectQuality}</span>
        </div>

        {/* ĐK */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-24">Độ khó (30%)</label>
          <input
            type="range" min="0" max="100" step="5" value={expectDifficulty}
            onChange={(e) => onUpdate("expect_difficulty", +e.target.value)}
            className="flex-1 accent-amber-400"
          />
          <span className="font-mono text-sm text-amber-400 w-8 text-right">{expectDifficulty}</span>
        </div>

        {/* VTĐ */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-24">Vượt T.Đ (+10%)</label>
          <input
            type="range" min="0" max="100" step="5" value={expectAhead}
            onChange={(e) => onUpdate("expect_ahead", +e.target.value)}
            className="flex-1 accent-purple-400"
          />
          <span className="font-mono text-sm text-purple-400 w-8 text-right">{expectAhead}</span>
        </div>

        {/* Score Preview */}
        <div className="flex items-center justify-center gap-4 pt-3 border-t border-primary/20">
          <div className="text-center">
            <p className="text-3xl font-bold font-mono text-primary">{expectScore}</p>
            <p className="text-[11px] text-muted-foreground">Điểm KPI kỳ vọng</p>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
            {expectVolume}×0.4 + {expectQuality}×0.3 + {expectDifficulty}×0.3 + {expectAhead}×0.1(bonus) = {expectScore}
          </div>
        </div>
      </div>
    </div>
  );
}
