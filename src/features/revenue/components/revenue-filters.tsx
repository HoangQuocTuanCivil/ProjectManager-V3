"use client";

import { useProjects } from "@/lib/hooks/use-projects";
import { useContracts } from "@/lib/hooks/use-contracts";
import { useProductServices } from "../hooks/use-product-services";
import { useI18n } from "@/lib/i18n";
import { SearchSelect } from "@/components/shared/search-select";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMemo } from "react";

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

function useCenters() {
  return useQuery({
    queryKey: ["centers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centers").select("id, name, code").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export interface RevenueFilterValues {
  project_id?: string;
  contract_id?: string;
  dept_id?: string;
  bid_package?: string;
  center_id?: string;
  date_from?: string;
  date_to?: string;
  // Giữ lại cho tương thích API nhưng không hiện filter UI
  dimension?: string;
  method?: string;
  source?: string;
  status?: string;
  product_service_id?: string;
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
  const { data: centers = [] } = useCenters();
  const { data: psRes } = useProductServices({ is_active: "true" });
  const productServices = psRes?.data ?? [];

  // Danh sách gói thầu duy nhất từ các hợp đồng
  const bidPackages = useMemo(() => {
    const set = new Set<string>();
    for (const c of contracts as any[]) {
      if (c.bid_package) set.add(c.bid_package);
    }
    return Array.from(set).sort();
  }, [contracts]);

  const set = (key: string, v: string) => onChange({ ...value, [key]: v || undefined });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48">
        <SearchSelect value={value.project_id || ""} onChange={(v) => set("project_id", v)}
          options={[{ value: "", label: t.revenue.allProjects }, ...projects.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` }))]}
          placeholder={t.revenue.selectProject} />
      </div>
      <div className="w-36">
        <SearchSelect value={value.bid_package || ""} onChange={(v) => set("bid_package", v)}
          options={[{ value: "", label: "Tất cả gói thầu" }, ...bidPackages.map((b) => ({ value: b, label: b }))]}
          placeholder="Gói thầu" />
      </div>
      <div className="w-44">
        <SearchSelect value={value.contract_id || ""} onChange={(v) => set("contract_id", v)}
          options={[{ value: "", label: "Tất cả HĐ" }, ...contracts.map((c: any) => ({ value: c.id, label: `${c.contract_no} — ${c.title}` }))]}
          placeholder={t.revenue.selectContract} />
      </div>
      <div className="w-40">
        <SearchSelect value={value.product_service_id || ""} onChange={(v) => set("product_service_id", v)}
          options={[{ value: "", label: "Tất cả SP/DV" }, ...productServices.map((ps) => ({ value: ps.id, label: `${ps.code} — ${ps.name}` }))]}
          placeholder="SP/DV" />
      </div>
      <div className="w-40">
        <SearchSelect value={value.center_id || ""} onChange={(v) => set("center_id", v)}
          options={[{ value: "", label: "Tất cả TT" }, ...(centers ?? []).map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` }))]}
          placeholder="Trung tâm" />
      </div>
      <div className="w-36">
        <SearchSelect value={value.dept_id || ""} onChange={(v) => set("dept_id", v)}
          options={[{ value: "", label: t.revenue.allDepts }, ...depts.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))]}
          placeholder={t.revenue.selectDept} />
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
