import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getVerdict } from "@/lib/utils/kpi";
import type { Task } from "@/lib/types";
import type { AcceptanceRecord, AcceptanceFilter, AcceptanceSummary, PaymentStatus } from "../types/acceptance.types";

const supabase = createClient();

export const acceptanceKeys = {
  all: ["acceptance"] as const,
  list: (filter?: AcceptanceFilter) => [...acceptanceKeys.all, "list", filter] as const,
  summary: (projectId?: string) => [...acceptanceKeys.all, "summary", projectId] as const,
};

// Transform task → AcceptanceRecord
function toAcceptanceRecord(task: Task): AcceptanceRecord {
  const variance = task.kpi_variance ?? 0;
  return {
    id: task.id,
    task,
    project: task.project,
    assignee: task.assignee,
    expect_score: task.expect_score,
    actual_score: task.actual_score,
    kpi_variance: variance,
    verdict: getVerdict(task.kpi_evaluated_at ? variance : null),
    kpi_note: task.kpi_note,
    submitted_at: task.updated_at, // approximation
    evaluated_at: task.kpi_evaluated_at,
    deadline: task.deadline,
    payment_status: (task.metadata?.payment_status as PaymentStatus) ?? "unpaid",
    payment_amount: (task.metadata?.payment_amount as number | null) ?? null,
    payment_date: (task.metadata?.payment_date as string | null) ?? null,
    payment_note: (task.metadata?.payment_note as string | null) ?? null,
  };
}


export function useAcceptanceRecords(filter?: AcceptanceFilter) {
  return useQuery({
    queryKey: acceptanceKeys.list(filter),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url, role, email),
          assigner:users!tasks_assigner_id_fkey(id, full_name),
          project:projects(id, code, name)
        `)
        .in("status", ["review", "completed"])
        .order("updated_at", { ascending: false });

      if (filter?.project_id) query = query.eq("project_id", filter.project_id);
      if (filter?.assignee_id) query = query.eq("assignee_id", filter.assignee_id);

      const { data, error } = await query;
      if (error) throw error;

      let records = (data as unknown as Task[]).map(toAcceptanceRecord);

      // Client-side filtering
      if (filter?.status && filter.status !== "all") {
        if (filter.status === "pending") records = records.filter((r) => !r.evaluated_at);
        else if (filter.status === "accepted") records = records.filter((r) => !!r.evaluated_at);
      }
      if (filter?.payment_status && filter.payment_status !== "all") {
        records = records.filter((r) => r.payment_status === filter.payment_status);
      }

      return records;
    },
    staleTime: 30_000,
  });
}


export function useAcceptanceSummary(projectId?: string) {
  return useQuery({
    queryKey: acceptanceKeys.summary(projectId),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("expect_score, actual_score, kpi_variance, kpi_evaluated_at, kpi_weight, metadata")
        .in("status", ["review", "completed"]);

      if (projectId) query = query.eq("project_id", projectId);

      const { data, error } = await query;
      if (error) throw error;

      const tasks = data || [];
      const evaluated = tasks.filter((t: any) => t.kpi_evaluated_at);
      const totalWeight = tasks.reduce((s: number, t: any) => s + (t.kpi_weight || 1), 0);
      const evalWeight = evaluated.reduce((s: number, t: any) => s + (t.kpi_weight || 1), 0);

      const summary: AcceptanceSummary = {
        total: tasks.length,
        pending: tasks.filter((t: any) => !t.kpi_evaluated_at).length,
        accepted: evaluated.length,
        rejected: 0,
        avgKpiE: totalWeight > 0 ? Math.round(tasks.reduce((s: number, t: any) => s + (t.expect_score || 0) * (t.kpi_weight || 1), 0) / totalWeight) : 0,
        avgKpiA: evalWeight > 0 ? Math.round(evaluated.reduce((s: number, t: any) => s + (t.actual_score || 0) * (t.kpi_weight || 1), 0) / evalWeight) : 0,
        avgVariance: evalWeight > 0 ? Math.round(evaluated.reduce((s: number, t: any) => s + (t.kpi_variance || 0) * (t.kpi_weight || 1), 0) / evalWeight) : 0,
        totalPayment: tasks.reduce((s: number, t: any) => s + (t.metadata?.payment_amount || 0), 0),
        paidAmount: tasks.filter((t: any) => t.metadata?.payment_status === "paid").reduce((s: number, t: any) => s + (t.metadata?.payment_amount || 0), 0),
      };

      return summary;
    },
  });
}


export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, payment_status, payment_amount, payment_date, payment_note }: {
      taskId: string;
      payment_status: string;
      payment_amount?: number;
      payment_date?: string;
      payment_note?: string;
    }) => {
      // Read current metadata, merge payment fields
      const { data: task } = await supabase.from("tasks").select("metadata").eq("id", taskId).single();
      const metadata = { ...((task?.metadata ?? {}) as Record<string, any>), payment_status, payment_amount, payment_date, payment_note };
      const { error } = await supabase.from("tasks").update({ metadata }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: acceptanceKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["kpi", "fund-summary"] });
    },
  });
}
