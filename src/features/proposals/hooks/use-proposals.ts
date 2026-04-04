import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TablesInsert } from '@/lib/types/database';

const supabase = createClient();

export const proposalKeys = {
  all: ['proposals'] as const,
  list: (filter?: string) => [...proposalKeys.all, 'list', filter] as const,
  pending: () => [...proposalKeys.all, 'pending'] as const,
};

export function useProposals(statusFilter?: string) {
  return useQuery({
    queryKey: proposalKeys.list(statusFilter),
    queryFn: async () => {
      let query = supabase
        .from('task_proposals')
        .select(`
          *,
          proposer:users!task_proposals_proposed_by_fkey(id, full_name, role, avatar_url),
          approver:users!task_proposals_approver_id_fkey(id, full_name, role, avatar_url),
          project:projects(id, code, name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        proposer: Array.isArray(p.proposer) ? p.proposer[0] || null : p.proposer,
        approver: Array.isArray(p.approver) ? p.approver[0] || null : p.approver,
        project: Array.isArray(p.project) ? p.project[0] || null : p.project,
      }));
    },
    staleTime: 15_000,
  });
}

export function useProposalPendingCount() {
  return useQuery({
    queryKey: proposalKeys.pending(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from('task_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('approver_id', user.id)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30_000,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      approver_id: string;
      project_id?: string;
      dept_id?: string;
      team_id?: string;
      priority?: string;
      task_type?: string;
      kpi_weight?: number;
      start_date?: string;
      deadline?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const { data: profile } = await supabase
        .from('users')
        .select('org_id, dept_id, team_id, full_name')
        .eq('id', user.id)
        .single();
      if (!profile) throw new Error('Không tìm thấy profile');

      // Clean empty strings
      const clean = { ...input };
      if (!clean.project_id) delete clean.project_id;
      if (!clean.dept_id) clean.dept_id = profile.dept_id ?? undefined;
      if (!clean.team_id) clean.team_id = profile.team_id ?? undefined;

      const { data, error } = await supabase
        .from('task_proposals')
        .insert({
          ...clean,
          org_id: profile.org_id,
          proposed_by: user.id,
        } as TablesInsert<'task_proposals'>)
        .select()
        .single();
      if (error) throw error;

      // Send notification to approver
      await supabase.from('notifications').insert({
        org_id: profile.org_id,
        user_id: input.approver_id,
        title: 'Đề xuất giao việc mới',
        body: `${profile.full_name} đề xuất: "${input.title}"`,
        type: 'task_proposal',
        data: { proposal_id: data.id, proposed_by: user.id },
      } as TablesInsert<'notifications'>);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.all });
    },
  });
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proposalId, overrides }: {
      proposalId: string;
      overrides?: { kpi_weight?: number; expect_volume?: number; expect_quality?: number; expect_difficulty?: number; expect_ahead?: number; deadline?: string };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Fetch proposal
      const { data: proposal, error: pErr } = await supabase
        .from('task_proposals')
        .select('*')
        .eq('id', proposalId)
        .single();
      if (pErr || !proposal) throw new Error('Không tìm thấy đề xuất');
      if (proposal.approver_id !== user.id) throw new Error('Bạn không có quyền duyệt đề xuất này');
      if (proposal.status !== 'pending') throw new Error('Đề xuất đã được xử lý');

      // Create task: assigner = approver, assignee = proposer
      const { data: task, error: tErr } = await supabase
        .from('tasks')
        .insert({
          org_id: proposal.org_id,
          title: proposal.title,
          description: proposal.description,
          project_id: proposal.project_id || null,
          dept_id: proposal.dept_id || null,
          team_id: proposal.team_id || null,
          priority: proposal.priority,
          task_type: proposal.task_type,
          kpi_weight: overrides?.kpi_weight ?? proposal.kpi_weight,
          start_date: proposal.start_date,
          deadline: overrides?.deadline ?? proposal.deadline,
          assigner_id: user.id,
          assignee_id: proposal.proposed_by,
          status: 'pending',
          expect_volume: overrides?.expect_volume ?? 100,
          expect_quality: overrides?.expect_quality ?? 80,
          expect_difficulty: overrides?.expect_difficulty ?? 50,
          expect_ahead: overrides?.expect_ahead ?? 100,
        } as TablesInsert<'tasks'>)
        .select()
        .single();
      if (tErr) throw tErr;

      // Update proposal status
      await supabase
        .from('task_proposals')
        .update({ status: 'approved', task_id: task.id, updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      // Notify proposer
      const { data: approverProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabase.from('notifications').insert({
        org_id: proposal.org_id,
        user_id: proposal.proposed_by,
        title: 'Đề xuất đã được duyệt',
        body: `${approverProfile?.full_name || 'Người duyệt'} đã duyệt đề xuất "${proposal.title}"`,
        type: 'proposal_approved',
        data: { proposal_id: proposalId, task_id: task.id },
      } as TablesInsert<'notifications'>);

      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.all });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      const { data: proposal, error: pErr } = await supabase
        .from('task_proposals')
        .select('*')
        .eq('id', proposalId)
        .single();
      if (pErr || !proposal) throw new Error('Không tìm thấy đề xuất');
      if (proposal.approver_id !== user.id) throw new Error('Bạn không có quyền từ chối đề xuất này');
      if (proposal.status !== 'pending') throw new Error('Đề xuất đã được xử lý');

      await supabase
        .from('task_proposals')
        .update({ status: 'rejected', reject_reason: reason || null, updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      // Notify proposer
      const { data: approverProfile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabase.from('notifications').insert({
        org_id: proposal.org_id,
        user_id: proposal.proposed_by,
        title: 'Đề xuất bị từ chối',
        body: `${approverProfile?.full_name || 'Người duyệt'} từ chối: "${proposal.title}"${reason ? ` — Lý do: ${reason}` : ''}`,
        type: 'proposal_rejected',
        data: { proposal_id: proposalId },
      } as TablesInsert<'notifications'>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.all });
    },
  });
}
