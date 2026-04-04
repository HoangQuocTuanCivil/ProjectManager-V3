import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { IntakeForm, FormSubmission } from "../types/form.types";

const supabase = createClient();

export const formKeys = {
  all: ["forms"] as const,
  list: () => [...formKeys.all, "list"] as const,
  detail: (id: string) => [...formKeys.all, id] as const,
  submissions: (formId?: string) => [...formKeys.all, "submissions", formId] as const,
};


export function useIntakeForms() {
  return useQuery({
    queryKey: formKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as IntakeForm[];
    },
    staleTime: 60_000,
  });
}

export function useIntakeForm(id: string) {
  return useQuery({
    queryKey: formKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_forms")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as IntakeForm;
    },
    enabled: !!id,
  });
}

export function useCreateIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<IntakeForm>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      const { data, error } = await supabase
        .from("intake_forms")
        .insert({ ...input, org_id: (profile as any).org_id, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.list() }),
  });
}

export function useUpdateIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntakeForm> & { id: string }) => {
      const { error } = await supabase
        .from("intake_forms")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: formKeys.list() });
      qc.invalidateQueries({ queryKey: formKeys.detail(vars.id) });
    },
  });
}


export function useFormSubmissions(formId?: string) {
  return useQuery({
    queryKey: formKeys.submissions(formId),
    queryFn: async () => {
      let query = supabase
        .from("form_submissions")
        .select("*, form:intake_forms(id, name), submitter:users!form_submissions_submitted_by_fkey(id, full_name, avatar_url, role)")
        .order("created_at", { ascending: false });

      if (formId) query = query.eq("form_id", formId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FormSubmission[];
    },
  });
}

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ formId, data }: { formId: string; data: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: result, error } = await supabase
        .from("form_submissions")
        .insert({ form_id: formId, submitted_by: user!.id, data, status: "submitted" } as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.submissions() }),
  });
}

export function useReviewSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "approved" | "rejected"; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("form_submissions")
        .update({
          status,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.submissions() }),
  });
}
