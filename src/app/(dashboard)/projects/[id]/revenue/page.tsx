"use client";

import { useParams } from "next/navigation";
import { useRevenueByProject } from "@/features/revenue/hooks/use-revenue-analytics";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores";
import { formatVND } from "@/lib/utils/format";
import { ProjectRevenueProgress } from "@/features/revenue/components/project-revenue-progress";
import { DeptAllocationChart } from "@/features/revenue/components/dept-allocation-chart";
import { AdjustmentTimeline } from "@/features/revenue/components/adjustment-timeline";
import { RevenueTable } from "@/features/revenue/components/revenue-table";

export default function ProjectRevenuePage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const params = useParams();
  const projectId = params.id as string;
  const canManage = !!user && ["admin", "leader", "director"].includes(user.role);

  const { data } = useRevenueByProject(projectId);
  const { data: contracts = [] } = useContracts();
  const projectContracts = contracts.filter((c: any) => c.project_id === projectId);
  const contractValue = projectContracts.reduce((s: number, c: any) => s + Number(c.contract_value ?? 0), 0);
  const contractIds = projectContracts.map((c: any) => c.id);

  const cards = [
    { label: t.revenue.totalConfirmed, value: data?.total_confirmed ?? 0, color: "text-green-500" },
    { label: "Số bút toán", value: data?.entry_count ?? 0, color: "text-primary" },
    { label: t.revenue.completionPercentage, value: `${data?.avg_completion ?? 0}%`, color: "text-accent" },
    { label: t.revenue.adjustment, value: data?.adjustments?.length ?? 0, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-5">
      <ProjectRevenueProgress recognized={data?.total_confirmed ?? 0} contractValue={contractValue} />

      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-bold font-mono ${c.color}`}>
              {typeof c.value === "number" ? formatVND(c.value) : c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DeptAllocationChart projectId={projectId} />
        {contractIds.length > 0 && <AdjustmentTimeline contractIds={contractIds} />}
      </div>

      <RevenueTable filters={{ project_id: projectId }} canManage={canManage} />
    </div>
  );
}
