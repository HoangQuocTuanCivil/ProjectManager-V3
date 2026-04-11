ALTER TABLE tasks DROP CONSTRAINT IF EXISTS no_self_parent;
ALTER TABLE tasks ADD CONSTRAINT no_self_parent CHECK (parent_task_id IS NULL OR parent_task_id != id);

ALTER TABLE task_dependencies DROP CONSTRAINT IF EXISTS no_self_dependency;
ALTER TABLE task_dependencies ADD CONSTRAINT no_self_dependency CHECK (task_id != depends_on_id);

ALTER TABLE goals DROP CONSTRAINT IF EXISTS no_self_parent_goal;
ALTER TABLE goals ADD CONSTRAINT no_self_parent_goal CHECK (parent_goal_id IS NULL OR parent_goal_id != id);

CREATE OR REPLACE FUNCTION fn_check_task_circular_dep()
RETURNS TRIGGER AS $$
DECLARE
  v_current UUID;
  v_depth INT := 0;
BEGIN
  v_current := NEW.depends_on_id;
  WHILE v_current IS NOT NULL AND v_depth < 20 LOOP
    IF v_current = NEW.task_id THEN
      RAISE EXCEPTION 'Circular task dependency detected';
    END IF;
    SELECT depends_on_id INTO v_current
    FROM task_dependencies
    WHERE task_id = v_current
    LIMIT 1;
    v_depth := v_depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_task_circular_dep ON task_dependencies;
CREATE TRIGGER trg_check_task_circular_dep
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION fn_check_task_circular_dep();

CREATE OR REPLACE FUNCTION fn_check_goal_circular_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_current UUID;
  v_depth INT := 0;
BEGIN
  IF NEW.parent_goal_id IS NULL THEN RETURN NEW; END IF;
  v_current := NEW.parent_goal_id;
  WHILE v_current IS NOT NULL AND v_depth < 20 LOOP
    IF v_current = NEW.id THEN
      RAISE EXCEPTION 'Circular goal hierarchy detected';
    END IF;
    SELECT parent_goal_id INTO v_current FROM goals WHERE id = v_current;
    v_depth := v_depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_goal_circular_hierarchy ON goals;
CREATE TRIGGER trg_check_goal_circular_hierarchy
  BEFORE INSERT OR UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION fn_check_goal_circular_hierarchy();
