
// use-projects.ts - Project CRUD hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectMember, Milestone, DepartmentSummary, MilestoneUpdateInput } from "@/lib/types";
import type { TablesInsert } from "@/lib/types/database";

const supabase = createClient();

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  paginated: (filters: ProjectListFilters) => [...projectKeys.all, "paginated", filters] as const,
  summary: () => [...projectKeys.all, "summary"] as const,
  detail: (id: string) => [...projectKeys.all, id] as const,
  members: (id: string) => [...projectKeys.all, id, "members"] as const,
  milestones: (id: string) => [...projectKeys.all, id, "milestones"] as const,
};

export interface ProjectSummaryItem {
  project_id: string;
  contract_count: number;
  outgoing_budget: number;
  incoming_fund: number;
  task_count: number;
  overdue_count: number;
}

export function useProjectsSummary() {
  return useQuery({
    queryKey: projectKeys.summary(),
    queryFn: async () => {
      const res = await fetch("/api/projects/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      const json = await res.json();
      const map = new Map<string, ProjectSummaryItem>();
      for (const s of json.data as ProjectSummaryItem[]) map.set(s.project_id, s);
      return map;
    },
    staleTime: 60_000,
  });
}

export interface ProjectListFilters {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
}

export function useProjectsPaginated(filters: ProjectListFilters = {}) {
  const { page = 1, per_page = 50, status, search } = filters;
  return useQuery({
    queryKey: projectKeys.paginated(filters),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{
        data: Project[];
        count: number | null;
        page: number;
        per_page: number;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`*, manager:users!projects_manager_id_fkey(id, full_name, avatar_url, role)`)
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch project-department assignments separately
      try {
        const { data: pdData } = await supabase
          .from("project_departments")
          .select("project_id, dept:departments(id, name, code)");

        if (pdData && pdData.length > 0) {
          const pdMap = new Map<string, { dept: DepartmentSummary }[]>();
          pdData.forEach((pd) => {
            const arr = pdMap.get(pd.project_id) || [];
            arr.push({ dept: pd.dept as DepartmentSummary });
            pdMap.set(pd.project_id, arr);
          });
          return data.map((p) => ({ ...p, departments: pdMap.get(p.id) || [] })) as unknown as Project[];
        }
      } catch {
        // table may not exist yet
      }

      return data as unknown as Project[];
    },
    staleTime: 60_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      // Fetch project with explicit FK hints to avoid ambiguous joins
      const { data, error } = await supabase
        .from("projects")
        .select(`*, manager:users!projects_manager_id_fkey(id, full_name, avatar_url, role), members:project_members(*, user:users(*)), milestones:milestones(*)`)
        .eq("id", id)
        .single();
      if (error) throw error;

      // Fetch project departments separately (M2M via project_departments)
      let departments: DepartmentSummary[] = [];
      try {
        const { data: pdData } = await supabase
          .from("project_departments")
          .select("dept:departments(id, name, code)")
          .eq("project_id", id);
        if (pdData) departments = pdData.map((pd) => pd.dept).filter(Boolean) as DepartmentSummary[];
      } catch {}

      return { ...data, departments } as unknown as Project & { members: ProjectMember[]; milestones: Milestone[]; departments: DepartmentSummary[] };
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Project> & { dept_ids?: string[] }) => {
      const { dept_ids, ...projectInput } = input;
      // Clean empty strings for UUID FK columns
      if (projectInput.manager_id === "") projectInput.manager_id = null;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("org_id").eq("id", user!.id).single();
      const { data, error } = await supabase.from("projects").insert({ ...projectInput, org_id: profile!.org_id } as TablesInsert<'projects'>).select().single();
      if (error) throw error;

      // Insert project-department assignments (graceful if table not yet created)
      if (dept_ids && dept_ids.length > 0) {
        const { error: deptErr } = await supabase.from("project_departments").insert(
          dept_ids.map((d) => ({ project_id: data.id, dept_id: d }))
        );
        if (deptErr && !deptErr.message?.includes("project_departments")) {
          throw deptErr;
        }
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
      qc.invalidateQueries({ queryKey: projectKeys.detail(vars.id) });
      // Cross-module: status change affects downstream modules
      if (vars.status) {
        qc.invalidateQueries({ queryKey: ["contracts"] });
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["revenue"] });
        qc.invalidateQueries({ queryKey: ["reports"] });
        qc.invalidateQueries({ queryKey: ["kpi"] });
      }
    },
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; user_id: string; role: string }) => {
      const { data, error } = await supabase.from("project_members").insert(input as TablesInsert<'project_members'>).select("*, user:users(*)").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: projectKeys.detail(vars.project_id) }),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from("project_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: projectKeys.detail(vars.project_id) }),
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; title: string; due_date: string; status?: string }) => {
      const { data, error } = await supabase.from("milestones").insert(input as TablesInsert<'milestones'>).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: projectKeys.detail(vars.project_id) }),
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: { id: string; project_id: string } & MilestoneUpdateInput) => {
      const { data, error } = await supabase.from("milestones").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: projectKeys.detail(vars.project_id) }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: projectKeys.detail(vars.project_id) }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Không thể xóa dự án");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
      qc.invalidateQueries({ queryKey: ["workflows", "pending"] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
  });
}

export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("projects") as any)
        .update({ deleted_at: null, status: "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["revenue"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
  });
}
