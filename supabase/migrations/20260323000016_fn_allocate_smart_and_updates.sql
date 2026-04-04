-- Migration 016: fn_allocate_smart + Missing Triggers + RLS Policies bổ sung

-- 1. fn_allocate_smart — Tính toán chia khoán thông minh

CREATE OR REPLACE FUNCTION fn_allocate_smart(
  p_period_id UUID,
  p_use_actual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
  v_period   RECORD;
  v_config   RECORD;
  v_total_ws NUMERIC := 0;
  v_count    INT := 0;
  r          RECORD;
BEGIN
  -- 1. Lấy thông tin đợt khoán
  SELECT ap.*, ac.weight_volume, ac.weight_quality, ac.weight_difficulty, ac.weight_ahead
  INTO v_period
  FROM allocation_periods ap
  JOIN allocation_configs ac ON ac.id = ap.config_id
  WHERE ap.id = p_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy đợt khoán');
  END IF;

  IF v_period.status = 'approved' OR v_period.status = 'paid' THEN
    RETURN jsonb_build_object('error', 'Đợt khoán đã được duyệt, không thể tính lại');
  END IF;

  -- 2. Xoá kết quả cũ
  DELETE FROM allocation_results WHERE period_id = p_period_id;

  -- 3. Tính KPI trung bình mỗi user từ tasks completed trong kỳ
  FOR r IN
    SELECT
      t.assignee_id AS user_id,
      COUNT(*)::INT AS task_count,
      AVG(CASE WHEN p_use_actual THEN t.actual_volume   ELSE t.expect_volume   END)::NUMERIC(5,2) AS avg_vol,
      AVG(CASE WHEN p_use_actual THEN t.actual_quality  ELSE t.expect_quality  END)::NUMERIC(5,2) AS avg_qual,
      AVG(CASE WHEN p_use_actual THEN t.actual_difficulty ELSE t.expect_difficulty END)::NUMERIC(5,2) AS avg_diff,
      AVG(CASE WHEN p_use_actual THEN t.actual_ahead    ELSE t.expect_ahead    END)::NUMERIC(5,2) AS avg_ahd
    FROM tasks t
    WHERE t.org_id = v_period.org_id
      AND t.status = 'completed'
      AND t.assignee_id IS NOT NULL
      AND t.completed_at::DATE BETWEEN v_period.period_start AND v_period.period_end
      AND (v_period.mode = 'global' OR t.project_id = v_period.project_id)
      AND (v_period.dept_id IS NULL OR t.dept_id = v_period.dept_id)
    GROUP BY t.assignee_id
  LOOP
    -- 4. Tính weighted score
    DECLARE
      ws NUMERIC(7,2);
    BEGIN
      ws := r.avg_vol  * v_period.weight_volume
          + r.avg_qual * v_period.weight_quality
          + r.avg_diff * v_period.weight_difficulty
          + r.avg_ahd  * v_period.weight_ahead;

      INSERT INTO allocation_results (
        period_id, user_id, project_id, mode,
        avg_volume, avg_quality, avg_difficulty, avg_ahead,
        weighted_score, task_count,
        breakdown
      ) VALUES (
        p_period_id, r.user_id, v_period.project_id, v_period.mode,
        r.avg_vol, r.avg_qual, r.avg_diff, r.avg_ahd,
        ws, r.task_count,
        jsonb_build_object(
          'volume', r.avg_vol, 'quality', r.avg_qual,
          'difficulty', r.avg_diff, 'ahead', r.avg_ahd,
          'use_actual', p_use_actual
        )
      );

      v_total_ws := v_total_ws + ws;
      v_count := v_count + 1;
    END;
  END LOOP;

  -- 5. Nếu không có ai, return
  IF v_count = 0 THEN
    UPDATE allocation_periods SET status = 'calculated', updated_at = NOW() WHERE id = p_period_id;
    RETURN jsonb_build_object('status', 'calculated', 'user_count', 0, 'message', 'Không có task hoàn thành trong kỳ');
  END IF;

  -- 6. Tính share_percentage + allocated_amount
  UPDATE allocation_results
  SET share_percentage = CASE WHEN v_total_ws > 0 THEN (weighted_score / v_total_ws) ELSE 0 END,
      allocated_amount = CASE WHEN v_total_ws > 0 THEN ROUND((weighted_score / v_total_ws) * v_period.total_fund) ELSE 0 END,
      calculated_at = NOW()
  WHERE period_id = p_period_id;

  -- 7. Update period status
  UPDATE allocation_periods SET status = 'calculated', updated_at = NOW() WHERE id = p_period_id;

  -- 8. Return summary
  RETURN jsonb_build_object(
    'status', 'calculated',
    'period_id', p_period_id,
    'user_count', v_count,
    'total_weighted_score', ROUND(v_total_ws, 2),
    'total_fund', v_period.total_fund,
    'mode', v_period.mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 2. Missing updated_at triggers

CREATE TRIGGER trg_proj_ts BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goal_ts BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_goalt_ts BEFORE UPDATE ON goal_targets FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocc_ts BEFORE UPDATE ON allocation_configs FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_allocp_ts BEFORE UPDATE ON allocation_periods FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_tmpl_ts BEFORE UPDATE ON task_templates FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_form_ts BEFORE UPDATE ON intake_forms FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_dash_ts BEFORE UPDATE ON dashboards FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_auto_ts BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_wft_ts BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
-- 3. RLS Policies bổ sung cho các bảng chưa có policy

-- Project Members
CREATE POLICY "pm_r" ON project_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id()));
CREATE POLICY "pm_m" ON project_members FOR ALL
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Goals sub-tables
CREATE POLICY "gt_r" ON goal_targets FOR SELECT
  USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND g.org_id = auth.user_org_id()));
CREATE POLICY "gt_m" ON goal_targets FOR ALL
  USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND g.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader','head'));

CREATE POLICY "gp_r" ON goal_projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND g.org_id = auth.user_org_id()));
CREATE POLICY "gp_m" ON goal_projects FOR ALL
  USING (EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND g.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Goals
CREATE POLICY "goal_r" ON goals FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "goal_m" ON goals FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader','head'));

-- Milestones
CREATE POLICY "ms_r" ON milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id()));
CREATE POLICY "ms_m" ON milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Task Comments
CREATE POLICY "tc_r" ON task_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "tc_i" ON task_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "tc_u" ON task_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tc_d" ON task_comments FOR DELETE USING (user_id = auth.uid() OR auth.user_role() IN ('admin','leader'));

-- Task Attachments
CREATE POLICY "ta_r" ON task_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "ta_i" ON task_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "ta_d" ON task_attachments FOR DELETE
  USING (uploaded_by = auth.uid() OR auth.user_role() IN ('admin','leader'));

-- Task Status Logs
CREATE POLICY "tsl_r" ON task_status_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));

-- Task Scores
CREATE POLICY "ts_r" ON task_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "ts_i" ON task_scores FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader','head'));

-- Task Dependencies
CREATE POLICY "td_r" ON task_dependencies FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "td_m" ON task_dependencies FOR ALL
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader','head'));

-- Task Checklists
CREATE POLICY "tcl_r" ON task_checklists FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "tcl_m" ON task_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));

-- Checklist Items
CREATE POLICY "ci_r" ON checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM task_checklists c JOIN tasks t ON t.id = c.task_id WHERE c.id = checklist_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "ci_m" ON checklist_items FOR ALL
  USING (EXISTS (SELECT 1 FROM task_checklists c JOIN tasks t ON t.id = c.task_id WHERE c.id = checklist_id AND t.org_id = auth.user_org_id()));

-- Time Entries
CREATE POLICY "te_r" ON time_entries FOR SELECT
  USING (user_id = auth.uid() OR auth.user_role() IN ('admin','leader','head'));
CREATE POLICY "te_own" ON time_entries FOR ALL USING (user_id = auth.uid());

-- KPI Configs
CREATE POLICY "kpic_r" ON kpi_configs FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "kpic_m" ON kpi_configs FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Allocation Configs
CREATE POLICY "ac_r" ON allocation_configs FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "ac_m" ON allocation_configs FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Allocation Periods
CREATE POLICY "ap_r" ON allocation_periods FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "ap_m" ON allocation_periods FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Allocation Results
CREATE POLICY "ar_r" ON allocation_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM allocation_periods ap WHERE ap.id = period_id AND ap.org_id = auth.user_org_id()));

-- KPI Records
CREATE POLICY "kr_self" ON kpi_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "kr_manage" ON kpi_records FOR SELECT
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Project KPI Summary
CREATE POLICY "pkpi_r" ON project_kpi_summary FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id()));

-- Global KPI Summary
CREATE POLICY "gkpi_r" ON global_kpi_summary FOR SELECT USING (org_id = auth.user_org_id());

-- User Sessions
CREATE POLICY "sess_own" ON user_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sess_m" ON user_sessions FOR ALL
  USING (user_id = auth.uid() OR auth.user_role() = 'admin');

-- User Invitations
CREATE POLICY "inv_r" ON user_invitations FOR SELECT
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));
CREATE POLICY "inv_m" ON user_invitations FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Custom Roles
CREATE POLICY "cr_r" ON custom_roles FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "cr_m" ON custom_roles FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() = 'admin');

-- Role Permissions
CREATE POLICY "rp_r" ON role_permissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM custom_roles cr WHERE cr.id = role_id AND cr.org_id = auth.user_org_id()));

-- Workflow Steps
CREATE POLICY "ws_r" ON workflow_steps FOR SELECT
  USING (EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = template_id AND wt.org_id = auth.user_org_id()));
CREATE POLICY "ws_m" ON workflow_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = template_id AND wt.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Workflow Transitions
CREATE POLICY "wtr_r" ON workflow_transitions FOR SELECT
  USING (EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = template_id AND wt.org_id = auth.user_org_id()));
CREATE POLICY "wtr_m" ON workflow_transitions FOR ALL
  USING (EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = template_id AND wt.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Task Workflow State
CREATE POLICY "tws_r" ON task_workflow_state FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));
CREATE POLICY "tws_m" ON task_workflow_state FOR ALL
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));

-- Workflow History
CREATE POLICY "wh_r" ON workflow_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.org_id = auth.user_org_id()));

-- Task Templates
CREATE POLICY "tt_r" ON task_templates FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "tt_m" ON task_templates FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Project Templates
CREATE POLICY "pt_r" ON project_templates FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "pt_m" ON project_templates FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Intake Forms
CREATE POLICY "if_r" ON intake_forms FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "if_m" ON intake_forms FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Form Submissions
CREATE POLICY "fs_r" ON form_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM intake_forms f WHERE f.id = form_id AND f.org_id = auth.user_org_id()));
CREATE POLICY "fs_i" ON form_submissions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM intake_forms f WHERE f.id = form_id AND f.org_id = auth.user_org_id()));

-- Status Updates
CREATE POLICY "su_r" ON status_updates FOR SELECT
  USING (
    (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.org_id = auth.user_org_id()))
    OR
    (goal_id IS NOT NULL AND EXISTS (SELECT 1 FROM goals g WHERE g.id = goal_id AND g.org_id = auth.user_org_id()))
  );
CREATE POLICY "su_m" ON status_updates FOR ALL
  USING (auth.user_role() IN ('admin','leader','head'));

-- Dashboard Widgets
CREATE POLICY "dw_r" ON dashboard_widgets FOR SELECT
  USING (EXISTS (SELECT 1 FROM dashboards d WHERE d.id = dashboard_id AND (d.owner_id = auth.uid() OR (d.is_shared AND d.org_id = auth.user_org_id()))));
CREATE POLICY "dw_m" ON dashboard_widgets FOR ALL
  USING (EXISTS (SELECT 1 FROM dashboards d WHERE d.id = dashboard_id AND d.owner_id = auth.uid()));

-- Automation Rules
CREATE POLICY "atr_r" ON automation_rules FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "atr_m" ON automation_rules FOR ALL
  USING (org_id = auth.user_org_id() AND auth.user_role() IN ('admin','leader'));

-- Automation Logs
CREATE POLICY "atl_r" ON automation_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM automation_rules ar WHERE ar.id = rule_id AND ar.org_id = auth.user_org_id())
    AND auth.user_role() IN ('admin','leader'));
