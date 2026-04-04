-- Migration: Storage buckets + attachment RLS policies

-- 1. Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure avatars bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- 3. Ensure storage RLS policies for task-files
DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-files');

DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
CREATE POLICY "task_files_select" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'task-files');

DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;
CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-files');

-- 3. Task_attachments RLS
-- Recreate all policies using auth.user_org_id() (auth.user_org_id does not exist)

-- SELECT: org members can read attachments
DROP POLICY IF EXISTS "ta_r" ON task_attachments;
CREATE POLICY "ta_r" ON task_attachments FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id()));

-- ALL: admin/leader/head full access
DROP POLICY IF EXISTS "ta_m" ON task_attachments;
CREATE POLICY "ta_m" ON task_attachments FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id()) AND auth.user_role() IN ('admin','leader','head'));

-- INSERT: any org member can upload
DROP POLICY IF EXISTS "ta_insert" ON task_attachments;
CREATE POLICY "ta_insert" ON task_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND task_id IN (SELECT id FROM tasks WHERE org_id = auth.user_org_id())
  );

-- DELETE: users can delete their own attachments
DROP POLICY IF EXISTS "ta_delete_own" ON task_attachments;
CREATE POLICY "ta_delete_own" ON task_attachments FOR DELETE
  USING (uploaded_by = auth.uid());
