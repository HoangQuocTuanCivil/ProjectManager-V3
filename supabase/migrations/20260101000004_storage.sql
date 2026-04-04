-- ============================================================================
-- A2Z WORKHUB — STORAGE BUCKETS & POLICIES
-- ============================================================================

-- ─── BUCKET: TASK FILES ──────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Đọc: public | Upload: authenticated | Xóa: authenticated
CREATE POLICY "task_files_select" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'task-files');

CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-files');

-- ─── BUCKET: AVATARS ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Đọc: public | Upload/Sửa/Xóa: authenticated
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

SELECT '✅ 004_storage: Storage buckets và policies đã tạo xong' AS status;
