import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskCreateInput, TaskFilters } from '@/lib/types';

const supabase = createClient();


export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};


export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url, role),
          assigner:users!tasks_assigner_id_fkey(id, full_name),
          project:projects(id, code, name),
          department:departments(id, name, code, center_id, center:centers(id, name, code))
        `)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all')
        query = query.eq('status', filters.status);
      if (filters.priority && filters.priority !== 'all')
        query = query.eq('priority', filters.priority);
      if (filters.project_id && filters.project_id !== 'all')
        query = query.eq('project_id', filters.project_id);
      if (filters.assignee_id && filters.assignee_id !== 'all')
        query = query.eq('assignee_id', filters.assignee_id);
      if (filters.team_id && filters.team_id !== 'all')
        query = query.eq('team_id', filters.team_id);
      if (filters.search)
        query = query.ilike('title', `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [] as Task[];

      // Fetch team names separately (new FK not auto-detected by PostgREST)
      const teamIds = [...new Set(data.map((t: any) => t.team_id).filter(Boolean))];
      let teamsMap: Record<string, any> = {};
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase.from('teams').select('id, name, code').in('id', teamIds);
        if (teamsData) teamsData.forEach((t: any) => { teamsMap[t.id] = t; });
      }

      return data.map((t: any) => {
        const dept = Array.isArray(t.department) ? t.department[0] || null : t.department;
        // Normalize center nested inside department
        if (dept?.center) {
          dept.center = Array.isArray(dept.center) ? dept.center[0] || null : dept.center;
        }
        return {
          ...t,
          team: teamsMap[t.team_id] || null,
          // Normalize joined relations (PostgREST may return arrays after schema reload)
          assignee: Array.isArray(t.assignee) ? t.assignee[0] || null : t.assignee,
          assigner: Array.isArray(t.assigner) ? t.assigner[0] || null : t.assigner,
          project: Array.isArray(t.project) ? t.project[0] || null : t.project,
          department: dept,
        };
      }) as Task[];
    },
    staleTime: 30_000,
  });
}


export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      // Main task with core relations only (avoid RLS-blocked tables)
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:users!tasks_assignee_id_fkey(id, full_name, avatar_url, role, email),
          assigner:users!tasks_assigner_id_fkey(id, full_name),
          project:projects(id, code, name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;

      // Fetch team separately
      if (data.team_id) {
        const { data: teamData } = await supabase.from('teams').select('id, name, code').eq('id', data.team_id).single();
        (data as any).team = teamData || null;
      }

      // Fetch optional relations separately (may be blocked by RLS)
      const [comments, checklists, wfState] = await Promise.all([
        supabase.from('task_comments').select('*, user:users(id, full_name, role)').eq('task_id', id).order('created_at'),
        supabase.from('task_checklists').select('*, items:checklist_items(*)').eq('task_id', id),
        supabase.from('task_workflow_state').select('*, current_step:workflow_steps(*)').eq('task_id', id).maybeSingle(),
      ]);

      return {
        ...data,
        comments: comments.data || [],
        checklists: checklists.data || [],
        attachments: [],
        dependencies: [],
        workflow_state: wfState.data || null,
      } as Task;
    },
    enabled: !!id,
  });
}


export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('users')
        .select('org_id, dept_id')
        .eq('id', user!.id)
        .single();

      // Clean empty strings → null for UUID fields
      const cleanInput = { ...input };
      if (!cleanInput.project_id) cleanInput.project_id = null as any;
      if (!cleanInput.assignee_id) cleanInput.assignee_id = null as any;
      if (!cleanInput.team_id) cleanInput.team_id = null as any;
      if (!cleanInput.dept_id) cleanInput.dept_id = "";

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...cleanInput,
          org_id: profile!.org_id,
          dept_id: cleanInput.dept_id || profile!.dept_id,
          assigner_id: user!.id,
          expect_volume: (input as any).expect_volume ?? 100,
          expect_ahead: (input as any).expect_ahead ?? 100,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}


export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
    },
  });
}


export function useEvaluateKPI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      task_id: string;
      actual_volume: number;
      actual_ahead: number;
      actual_quality: number;
      actual_difficulty: number;
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('fn_evaluate_task_kpi', {
        p_task: params.task_id,
        p_eval: user!.id,
        p_vol: params.actual_volume,
        p_ahd: params.actual_ahead,
        p_qual: params.actual_quality,
        p_diff: params.actual_difficulty,
        p_note: params.note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}


export function useUpdateProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      // Permission check: only assignee or admin can update progress
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Chưa đăng nhập');

      const [{ data: profile }, { data: taskData }] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('tasks').select('assignee_id').eq('id', id).single(),
      ]);
      if (!taskData) throw new Error('Không tìm thấy công việc');

      const isAdmin = profile?.role === 'admin';
      const isAssignee = taskData.assignee_id === authUser.id;
      if (!isAdmin && !isAssignee) {
        throw new Error('Chỉ người được giao hoặc Admin mới có thể cập nhật tiến độ');
      }

      const updates: any = { progress };
      // Auto-sync status based on progress:
      // 0% → pending (Đang chuẩn bị)
      // 0% < progress < 100% → in_progress (Đang làm)
      // 100% → review (Chờ duyệt)
      if (progress === 0) updates.status = 'pending';
      else if (progress === 100) updates.status = 'review';
      else updates.status = 'in_progress';
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Auto-advance workflow from "execute" to "review" step
      if (progress === 100) {
        try {
          const { data: wfState } = await supabase
            .from("task_workflow_state")
            .select("current_step_id, current_step:workflow_steps(step_type)")
            .eq("task_id", id)
            .is("completed_at", null)
            .maybeSingle();
          if (wfState?.current_step && (wfState.current_step as any).step_type === 'execute') {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.rpc("fn_workflow_advance", {
              p_task: id, p_actor: user!.id, p_result: "completed",
              p_note: "Tự động chuyển khi tiến độ đạt 100%",
            });
          }
        } catch {}
      }

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: ["workflows", "pending"] });
    },
  });
}
