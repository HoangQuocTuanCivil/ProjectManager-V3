"use client";

import { useMemo } from "react";
import { useRevenueEntries } from "@/lib/hooks/use-revenue";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useI18n } from "@/lib/i18n";
import { formatVND } from "@/lib/utils/format";

interface Props {
  from?: string;
  to?: string;
  projectId?: string;
}

export function RevenueSummaryCards({ from, to, projectId }: Props) {
  const { t } = useI18n();
  const { data: entriesRes, isLoading: loadingEntries } = useRevenueEntries({ date_from: from, date_to: to, project_id: projectId, per_page: 500 });
  const { data: allContracts = [], isLoading: loadingContracts } = useContracts();
  const isLoading = loadingEntries || loadingContracts;

  const stats = useMemo(() => {
    const entries = entriesRes?.data ?? [];

    // HĐ đầu ra active/completed — giá trị hợp đồng
    const outgoingContracts = (allContracts as any[]).filter((c) =>
      c.contract_type === "outgoing" && ["active", "completed"].includes(c.status)
      && (!projectId || c.project_id === projectId)
    );

    // Tổng doanh thu = giá trị HĐ đầu ra + entries nhập thủ công (confirmed)
    const contractTotal = outgoingContracts.reduce((s, c) => s + Number(c.contract_value), 0);
    const manualTotal = entries.filter((e: any) => e.status === "confirmed").reduce((s, e: any) => s + Number(e.amount), 0);
    const totalRevenue = contractTotal + manualTotal;

    // DT trong/ngoài hệ thống — tính từ contract_scope của HĐ đầu ra
    let internal = 0;
    let external = 0;
    for (const c of outgoingContracts) {
      const val = Number(c.contract_value);
      if (c.contract_scope === "external") external += val;
      else internal += val;
    }
    // Entries thủ công tính vào "trong HT" (không gắn HĐ)
    for (const e of entries as any[]) {
      if (e.status !== "confirmed") continue;
      const scope = e.contract?.contract_scope || "internal";
      const amt = Number(e.amount);
      if (scope === "external") external += amt;
      else internal += amt;
    }

    return { totalRevenue, internal, external, contractCount: outgoingContracts.length };
  }, [entriesRes, allContracts, projectId]);

  const cards = [
    { label: t.revenue.totalRevenue, value: stats.totalRevenue, color: "text-primary", sub: `${stats.contractCount} hợp đồng` },
    {
      label: "DT trong / ngoài HT",
      value: null,
      render: () => (
        <div className="space-y-0.5">
          <p className="text-sm font-bold font-mono text-blue-500">Trong: {formatVND(stats.internal)}</p>
          <p className="text-sm font-bold font-mono text-amber-500">Ngoài: {formatVND(stats.external)}</p>
        </div>
      ),
    },
    {
      label: t.revenue.recognizedVsForecast,
      value: null,
      render: () => (
        <div>
          <p className="text-lg font-bold font-mono text-green-500">{formatVND(stats.totalRevenue)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3" role="list" aria-label={t.revenue.totalRevenue}>
      {cards.map((c, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3" role="listitem">
          <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
          {isLoading ? (
            <div className="h-7 w-24 bg-secondary rounded animate-pulse" />
          ) : "render" in c && c.render ? (
            <div>{c.render()}</div>
          ) : (
            <>
              <p className={`text-lg font-bold font-mono ${c.color}`}>{formatVND(c.value as number)}</p>
              {"sub" in c && c.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
