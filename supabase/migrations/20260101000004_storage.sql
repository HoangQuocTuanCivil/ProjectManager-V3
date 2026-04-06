-- ============================================================================
-- A2Z WORKHUB — STORAGE BUCKETS & POLICIES
-- Dùng DO block + exception handling để bỏ qua nếu policy đã tồn tại
-- (Supabase Cloud tự tạo 1 số policies mặc định)
-- ============================================================================

-- ─── BUCKET: TASK FILES ──────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "task_files_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── BUCKET: AVATARS ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT '✅ 004_storage: Storage buckets và policies đã tạo xong' AS status;
