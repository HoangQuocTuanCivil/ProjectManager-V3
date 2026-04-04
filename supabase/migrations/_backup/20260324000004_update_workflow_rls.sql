-- Fix: workflow_steps and workflow_transitions RLS policies
-- The original migration used "workflow_id" but the actual column is "template_id"

-- Drop the broken policies (wrong column name: workflow_id)
DROP POLICY IF EXISTS "ws_r" ON workflow_steps;
DROP POLICY IF EXISTS "ws_m" ON workflow_steps;
DROP POLICY IF EXISTS "wt_r" ON workflow_transitions;
DROP POLICY IF EXISTS "wt_m" ON workflow_transitions;

-- Recreate with correct column name: template_id
DROP POLICY IF EXISTS "ws_r" ON workflow_steps;
CREATE POLICY "ws_r" ON workflow_steps FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id()));

DROP POLICY IF EXISTS "ws_m" ON workflow_steps;
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader'));

DROP POLICY IF EXISTS "wt_r" ON workflow_transitions;
CREATE POLICY "wt_r" ON workflow_transitions FOR SELECT
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id()));

DROP POLICY IF EXISTS "wt_m" ON workflow_transitions;
CREATE POLICY "wt_m" ON workflow_transitions FOR ALL
  USING (template_id IN (SELECT id FROM workflow_templates WHERE org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin', 'leader'));
