DROP POLICY IF EXISTS "notif_insert" ON notifications;

CREATE POLICY "notif_insert" ON notifications FOR INSERT
  WITH CHECK (org_id = public.user_org_id());
