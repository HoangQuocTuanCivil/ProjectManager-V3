"use client";

import { useState } from "react";
import { useEvaluateKPI } from "@/lib/hooks/use-tasks";
import { Button, KPIRing, KPIScoreBar } from "@/components/shared";
import { calcKPIScore } from "@/lib/utils/kpi";
import { useUpdatePayment } from "../hooks/use-acceptance-records";
import { PaymentStatusBadge } from "./payment-status";
import type { AcceptanceRecord } from "../types/acceptance.types";
import type { PaymentStatus } from "../types/acceptance.types";
import { SearchSelect } from "@/shared/ui/search-select";


export function AcceptanceEvalForm({
  record,
  onClose,
}: {
  record: AcceptanceRecord;
  onClose: () => void;
}) {
  const evaluateKPI = useEvaluateKPI();
  const task = record.task;
  const [volume, setVolume] = useState(task.actual_volume ?? 100);
  const [ahead, setAhead] = useState(task.actual_ahead ?? 50);
  const [quality, setQuality] = useState(80);
  const [difficulty, setDifficulty] = useState(70);
  const [note, setNote] = useState("");

  const previewScore = calcKPIScore(volume, quality, difficulty, ahead);

  const handleSubmit = async () => {
    await evaluateKPI.mutateAsync({
      task_id: record.id,
      actual_volume: volume,
      actual_ahead: ahead,
      actual_quality: quality,
      actual_difficulty: difficulty,
      note: note || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold">Nghiệm thu & Chấm KPI</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Task info */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-sm font-bold">{task.title}</p>
            {task.project && (
              <p className="text-[11px] font-mono text-primary mt-0.5">{task.project.code} — {task.project.name}</p>
            )}
          </div>

          {/* Expected scores */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-2">KPI Kỳ vọng (E): {Math.round(task.expect_score)}</p>
            <div className="space-y-1">
              <KPIScoreBar label="KL" value={task.expect_volume} color="#38bdf8" weight="40%" />
              <KPIScoreBar label="CL" value={task.expect_quality} color="#10b981" weight="30%" />
              <KPIScoreBar label="ĐK" value={task.expect_difficulty} color="#f59e0b" weight="20%" />
              <KPIScoreBar label="VTĐ" value={task.expect_ahead} color="#8b5cf6" weight="10%" />
            </div>
          </div>

          {/* Evaluation sliders */}
          <div className="border-2 border-amber-500/30 rounded-xl p-4 bg-amber-500/5 space-y-3">
            <p className="text-sm font-bold text-amber-400">Chấm điểm thực tế (A)</p>
            <p className="text-[11px] text-muted-foreground">Điều chỉnh cả 4 chỉ số KPI: Khối lượng, Chất lượng, Độ khó, Vượt tiến độ.</p>

            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-24">Khối lượng</label>
              <input type="range" min="0" max="100" step="5" value={volume} onChange={(e) => setVolume(+e.target.value)} className="flex-1 accent-sky-400" />
              <span className="font-mono text-sm text-sky-400 w-8 text-right">{volume}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-24">Chất lượng</label>
              <input type="range" min="0" max="100" step="5" value={quality} onChange={(e) => setQuality(+e.target.value)} className="flex-1 accent-green-400" />
              <span className="font-mono text-sm text-green-400 w-8 text-right">{quality}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-24">Độ khó</label>
              <input type="range" min="0" max="100" step="5" value={difficulty} onChange={(e) => setDifficulty(+e.target.value)} className="flex-1 accent-amber-400" />
              <span className="font-mono text-sm text-amber-400 w-8 text-right">{difficulty}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-24">Vượt T.Đ</label>
              <input type="range" min="0" max="100" step="5" value={ahead} onChange={(e) => setAhead(+e.target.value)} className="flex-1 accent-purple-400" />
              <span className="font-mono text-sm text-purple-400 w-8 text-right">{ahead}</span>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Ghi chú nghiệm thu</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Nhận xét chất lượng, yêu cầu sửa đổi..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Preview */}
            <div className="flex items-center justify-between pt-3 border-t border-amber-500/20">
              <div className="flex items-center gap-3">
                <KPIRing score={previewScore} size={44} strokeWidth={3} />
                <div>
                  <p className="font-mono text-lg font-bold text-amber-400">{previewScore}</p>
                  <p className="text-[10px] text-muted-foreground">Điểm A dự kiến</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-base" style={{ color: previewScore >= task.expect_score ? "#10b981" : "#ef4444" }}>
                  Δ {previewScore >= task.expect_score ? "+" : ""}{previewScore - Math.round(task.expect_score)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={evaluateKPI.isPending}>
            {evaluateKPI.isPending ? "Đang xử lý..." : "Xác nhận nghiệm thu"}
          </Button>
        </div>
      </div>
    </div>
  );
}


export function PaymentForm({
  record,
  onClose,
}: {
  record: AcceptanceRecord;
  onClose: () => void;
}) {
  const updatePayment = useUpdatePayment();
  const [status, setStatus] = useState<PaymentStatus>(record.payment_status);
  const [amount, setAmount] = useState(record.payment_amount || 0);
  const [date, setDate] = useState(record.payment_date || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(record.payment_note || "");

  const handleSubmit = async () => {
    await updatePayment.mutateAsync({
      taskId: record.id,
      payment_status: status,
      payment_amount: amount,
      payment_date: date,
      payment_note: note || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold">Cập nhật thanh toán</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-sm font-bold">{record.task.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">KPI A: {Math.round(record.actual_score)} · Δ {record.kpi_variance >= 0 ? "+" : ""}{Math.round(record.kpi_variance)}</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground font-medium">Trạng thái thanh toán</label>
            <SearchSelect
              value={status}
              onChange={(val) => setStatus(val as PaymentStatus)}
              options={[
                { value: "unpaid", label: "Chưa thanh toán" },
                { value: "pending_payment", label: "Chờ chi" },
                { value: "paid", label: "Đã chi" },
                { value: "rejected", label: "Từ chối" },
              ]}
              placeholder="Chọn trạng thái"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground font-medium">Số tiền (VNĐ)</label>
            <input
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(+e.target.value)}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground font-medium">Ngày thanh toán</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground font-medium">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú thanh toán..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={updatePayment.isPending}>
            {updatePayment.isPending ? "Đang lưu..." : "Cập nhật"}
          </Button>
        </div>
      </div>
    </div>
  );
}
