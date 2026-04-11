-- ============================================================================
-- A2Z WORKHUB — STORAGE BUCKETS & POLICIES (consolidated)
-- Tất cả bucket lưu trữ và chính sách truy cập
-- DO/EXCEPTION để bỏ qua nếu policy đã tồn tại (Supabase tự tạo mặc định)
-- ============================================================================

-- ─── BUCKET: TASK FILES ──────────────────────────────────────────────────────
-- File đính kèm task: public, tối đa 50MB, mọi loại file

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "task_files_select" ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'task-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── BUCKET: AVATARS ─────────────────────────────────────────────────────────
-- Ảnh đại diện: public, tối đa 3MB, chỉ ảnh

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── BUCKET: CONTRACT FILES ─────────────────────────────────────────────────
-- File hợp đồng: private, tối đa 50MB, chỉ authenticated truy cập

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contract-files', 'contract-files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "contract_files_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "contract_files_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "contract_files_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'contract-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
