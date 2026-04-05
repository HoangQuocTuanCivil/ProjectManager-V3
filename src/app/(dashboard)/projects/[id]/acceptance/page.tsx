"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/lib/stores";
import { Section, StatCard, FilterChip, EmptyState, Button, KPIRing } from "@/components/shared";
import { CheckCircle2, Target, Coins } from "lucide-react";
import { formatVND } from "@/lib/utils/kpi";
import {
  useAcceptanceRecords,
  useAcceptanceSummary,
  AcceptanceTable,
  AcceptanceEvalForm,
  PaymentForm,
  PaymentStatusBadge,
  PaymentSummaryCard,
  type AcceptanceRecord,
  type AcceptanceStatus,
  type PaymentStatus as PaymentStatusType,
} from "@/features/acceptance";

type TabKey = "pending" | "accepted" | "payment";

export default function ProjectAcceptancePage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabKey>("pending");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatusType | "all">("all");

  const { data: records = [], isLoading } = useAcceptanceRecords({ project_id: projectId });
  const { data: summary } = useAcceptanceSummary(projectId);

  const [evalRecord, setEvalRecord] = useState<AcceptanceRecord | null>(null);
  const [payRecord, setPayRecord] = useState<AcceptanceRecord | null>(null);

  const pending = records.filter((r) => !r.evaluated_at);
  const accepted = records.filter((r) => !!r.evaluated_at);
  const canEvaluate = user && ["admin", "leader", "head"].includes(user.role);

  const paymentRecords = paymentFilter === "all"
    ? accepted
    : accepted.filter((r) => r.payment_status === paymentFilter);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "pending", label: "Chờ nghiệm thu", count: pending.length },
    { key: "accepted", label: "Đã nghiệm thu", count: accepted.length },
    { key: "payment", label: "Thanh toán", count: accepted.length },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Tổng sản phẩm" value={summary?.total ?? records.length} accentColor="hsl(var(--primary))" />
        <StatCard label="Chờ nghiệm thu" value={summary?.pending ?? pending.length} accentColor="#f59e0b" />
        <StatCard label="Đã nghiệm thu" value={summary?.accepted ?? accepted.length} accentColor="#10b981" />
        <StatCard
          label="KPI TB (E→A)"
          value={summary ? `${summary.avgKpiE}→${summary.avgKpiA}` : "—"}
          subtitle={summary?.avgVariance !== undefined ? `Δ ${summary.avgVariance >= 0 ? "+" : ""}${summary.avgVariance}` : ""}
          accentColor={(summary?.avgVariance ?? 0) >= 0 ? "#10b981" : "#ef4444"}
        />
        <PaymentSummaryCard
          totalAmount={summary?.totalPayment ?? 0}
          paidAmount={summary?.paidAmount ?? 0}
          pendingCount={accepted.filter((r) => r.payment_status === "pending_payment").length}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] bg-secondary px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab: Pending */}
      {tab === "pending" && (
        <Section title={`Chờ nghiệm thu (${pending.length})`}>
          {isLoading ? (
            <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}</div>
          ) : pending.length === 0 ? (
            <div className="p-6"><EmptyState icon={<CheckCircle2 size={32} strokeWidth={1.5} />} title="Không có sản phẩm chờ nghiệm thu" /></div>
          ) : (
            <div className="divide-y divide-border/40">
              {pending.map((record) => (
                <div key={record.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{record.task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span>W:{record.task.kpi_weight}</span>
                      <span>·</span>
                      <span>Deadline: {record.deadline ? new Date(record.deadline).toLocaleDateString("vi-VN") : "—"}</span>
                      {record.assignee && (
                        <>
                          <span>·</span>
                          <span>{record.assignee.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <KPIRing score={record.expect_score} size={32} strokeWidth={3} />
                    <span className="font-mono text-sm">E: {Math.round(record.expect_score)}</span>
                  </div>
                  {canEvaluate && (
                    <Button size="xs" variant="primary" onClick={() => setEvalRecord(record)}>
                      Nghiệm thu
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Tab: Accepted */}
      {tab === "accepted" && (
        <Section title={`Đã nghiệm thu (${accepted.length})`}>
          {accepted.length === 0 ? (
            <div className="p-6"><EmptyState icon={<Target size={32} strokeWidth={1.5} />} title="Chưa có sản phẩm được nghiệm thu" /></div>
          ) : (
            <AcceptanceTable records={accepted} showPayment={false} />
          )}
        </Section>
      )}

      {/* Tab: Payment */}
      {tab === "payment" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FilterChip active={paymentFilter === "all"} onClick={() => setPaymentFilter("all")}>Tất cả</FilterChip>
            {(["unpaid", "pending_payment", "paid", "rejected"] as PaymentStatusType[]).map((s) => (
              <FilterChip key={s} active={paymentFilter === s} onClick={() => setPaymentFilter(s)}>
                <PaymentStatusBadge status={s} />
              </FilterChip>
            ))}
          </div>

          <Section title={`Thanh toán (${paymentRecords.length})`}>
            {paymentRecords.length === 0 ? (
              <div className="p-6"><EmptyState icon={<Coins size={32} strokeWidth={1.5} />} title="Không có bản ghi" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Sản phẩm", "Người làm", "KPI A", "Δ", "Thanh toán", "Số tiền", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRecords.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium truncate max-w-[200px]">{r.task.title}</td>
                        <td className="px-4 py-2.5 text-sm">{r.assignee?.full_name || "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <KPIRing score={r.actual_score} size={24} strokeWidth={2} />
                            <span className="font-mono text-sm font-bold">{Math.round(r.actual_score)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-sm font-bold" style={{ color: r.kpi_variance >= 0 ? "#10b981" : "#ef4444" }}>
                            {r.kpi_variance >= 0 ? "+" : ""}{Math.round(r.kpi_variance)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><PaymentStatusBadge status={r.payment_status} /></td>
                        <td className="px-4 py-2.5 font-mono text-sm text-amber-500 font-semibold">
                          {r.payment_amount ? formatVND(r.payment_amount) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {canEvaluate && (
                            <Button size="xs" variant="ghost" onClick={() => setPayRecord(r)}>
                              Cập nhật
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Modals */}
      {evalRecord && <AcceptanceEvalForm record={evalRecord} onClose={() => setEvalRecord(null)} />}
      {payRecord && <PaymentForm record={payRecord} onClose={() => setPayRecord(null)} />}
    </div>
  );
}
