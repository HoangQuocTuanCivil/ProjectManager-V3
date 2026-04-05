import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DeptRevenueAllocation } from "@/lib/types";

const supabase = createClient();

const deptRevKeys = {
  all: ["revenue", "dept-allocations"] as const,
  list: () => [...deptRevKeys.all, "list"] as const,
  byProject: (projectId: string) => [...deptRevKeys.all, "project", projectId] as const,
};

export function useDeptRevenue() {
  return useQuery({
    queryKey: deptRevKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dept_revenue_allocations")
        .select("*, department:departments(id, name, code), revenue_entry:revenue_entries(id, description, amount, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DeptRevenueAllocation[];
    },
  });
}

export function useDeptRevenueByProject(projectId: string) {
  return useQuery({
    queryKey: deptRevKeys.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dept_revenue_allocations")
        .select("*, department:departments(id, name, code), revenue_entry:revenue_entries(id, description, amount, status)")
        .eq("project_id", projectId)
        .order("allocation_percentage", { ascending: false });
      if (error) throw error;
      return data as unknown as DeptRevenueAllocation[];
    },
    enabled: !!projectId,
  });
}
