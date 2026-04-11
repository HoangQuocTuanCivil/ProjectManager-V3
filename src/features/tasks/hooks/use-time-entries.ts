import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { taskKeys } from "./use-tasks";

const supabase = createClient();

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  description: string | null;
  is_billable: boolean;
  created_at: string;
  user?: { id: string; full_name: string; avatar_url: string | null };
}

export const timeEntryKeys = {
  all: ["time-entries"] as const,
  list: (taskId: string) => [...timeEntryKeys.all, taskId] as const,
};

export function useTimeEntries(taskId: string) {
  return useQuery({
    queryKey: timeEntryKeys.list(taskId),
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`);
      if (!res.ok) throw new Error("Lỗi tải time entries");
      const json = await res.json();
      return json.data as TimeEntry[];
    },
    enabled: !!taskId,
    staleTime: 30_000,
  });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      task_id: string;
      duration_minutes: number;
      start_time?: string;
      end_time?: string;
      description?: string;
      is_billable?: boolean;
    }) => {
      const res = await fetch(`/api/tasks/${input.task_id}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lỗi tạo time entry");
      return json.data as TimeEntry;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: timeEntryKeys.list(vars.task_id) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.task_id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: timeEntryKeys.list(vars.task_id) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.task_id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
