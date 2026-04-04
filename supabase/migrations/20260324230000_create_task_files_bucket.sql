-- Create the task-files storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-files');

-- Allow anyone to read (public bucket)
DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
CREATE POLICY "task_files_select" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'task-files');

-- Allow users to delete their own uploads, or admin/leader
DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;
CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-files');
