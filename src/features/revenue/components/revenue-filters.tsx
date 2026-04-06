"use client";

import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useProductServices } from "../hooks/use-product-services";
import { useI18n } from "@/lib/i18n";
import { SearchSelect } from "@/components/shared/search-select";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function useDepts() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export interface RevenueFilterValues {
  project_id?: string;
  contract_id?: string;
  dept_id?: string;
  dimension?: string;
  method?: string;
  source?: string;
  status?: string;
  product_service_id?: string;
  date_from?: string;
  date_to?: string;
}

interface Props {
  value: RevenueFilterValues;
  onChange: (v: RevenueFilterValues) => void;
}

export function RevenueFilters({ value, onChange }: Props) {
  const { t } = useI18n();
  const { data: projects = [] } = useProjects();
  const { data: contracts = [] } = useContracts();
  const { data: depts = [] } = useDepts();
  const { data: psRes } = useProductServices({ is_active: "true" });
  const productServices = psRes?.data ?? [];

  const set = (key: string, v: string) => onChange({ ...value, [key]: v || undefined });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48">
        <SearchSelect value={value.project_id || ""} onChange={(v) => set("project_id", v)}
          options={[{ value: "", label: t.revenue.allProjects }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
          placeholder={t.revenue.selectProject} />
      </div>
      <div className="w-44">
        <SearchSelect value={value.contract_id || ""} onChange={(v) => set("contract_id", v)}
          options={[{ value: "", label: "—" }, ...contracts.map((c: any) => ({ value: c.id, label: c.contract_no }))]}
          placeholder={t.revenue.selectContract} />
      </div>
      <div className="w-40">
        <SearchSelect value={value.dept_id || ""} onChange={(v) => set("dept_id", v)}
          options={[{ value: "", label: t.revenue.allDepts }, ...depts.map((d) => ({ value: d.id, label: d.code }))]}
          placeholder={t.revenue.selectDept} />
      </div>
      <div className="w-36">
        <SearchSelect value={value.dimension || ""} onChange={(v) => set("dimension", v)}
          options={[
            { value: "", label: t.revenue.allDimensions },
            { value: "project", label: t.revenue.dimProject },
            { value: "contract", label: t.revenue.dimContract },
            { value: "period", label: t.revenue.dimPeriod },
            { value: "product_service", label: t.revenue.dimProductService },
          ]} />
      </div>
      <div className="w-36">
        <SearchSelect value={value.method || ""} onChange={(v) => set("method", v)}
          options={[
            { value: "", label: "—" },
            { value: "acceptance", label: t.revenue.methodAcceptance },
            { value: "completion_rate", label: t.revenue.methodCompletion },
            { value: "time_based", label: t.revenue.methodTime },
          ]} />
      </div>
      <div className="w-32">
        <SearchSelect value={value.status || ""} onChange={(v) => set("status", v)}
          options={[
            { value: "", label: t.revenue.allStatuses },
            { value: "draft", label: t.revenue.statusDraft },
            { value: "confirmed", label: t.revenue.statusConfirmed },
            { value: "adjusted", label: t.revenue.statusAdjusted },
            { value: "cancelled", label: t.revenue.statusCancelled },
          ]} />
      </div>
      <div className="w-36">
        <SearchSelect value={value.source || ""} onChange={(v) => set("source", v)}
          options={[
            { value: "", label: t.revenue.allSources },
            { value: "billing_milestone", label: t.revenue.sourceBilling },
            { value: "acceptance", label: t.revenue.sourceAcceptance },
            { value: "manual", label: t.revenue.sourceManual },
          ]} />
      </div>
      <div className="w-44">
        <SearchSelect value={value.product_service_id || ""} onChange={(v) => set("product_service_id", v)}
          options={[{ value: "", label: "—" }, ...productServices.map((ps) => ({ value: ps.id, label: `${ps.code} — ${ps.name}` }))]}
          placeholder={t.revenue.productService} />
      </div>
      <input type="date" value={value.date_from || ""} onChange={(e) => set("date_from", e.target.value)}
        className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
        aria-label={t.revenue.periodStart} />
      <input type="date" value={value.date_to || ""} onChange={(e) => set("date_to", e.target.value)}
        className="h-8 px-2 rounded-lg border border-border bg-secondary text-xs focus:border-primary focus:outline-none"
        aria-label={t.revenue.periodEnd} />
    </div>
  );
}
