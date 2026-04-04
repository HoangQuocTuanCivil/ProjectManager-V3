-- Fix workflow_templates RLS: allow director, head, team_leader to manage workflows
DROP POLICY IF EXISTS "wf_m" ON workflow_templates;
CREATE POLICY "wf_m" ON workflow_templates FOR ALL
  USING (org_id = public.user_org_id() AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));

-- Fix workflow_steps RLS
DROP POLICY IF EXISTS "ws_m" ON workflow_steps;
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));

-- Fix workflow_transitions RLS
DROP POLICY IF EXISTS "wt_m" ON workflow_transitions;
CREATE POLICY "wt_m" ON workflow_transitions FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = public.user_org_id())
    AND public.user_role() IN ('admin', 'leader', 'director', 'head', 'team_leader'));
