
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS spaces jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_images_public_read" ON storage.objects;
CREATE POLICY "project_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "project_images_admin_write" ON storage.objects;
CREATE POLICY "project_images_admin_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-images' AND public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "project_images_admin_update" ON storage.objects;
CREATE POLICY "project_images_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-images' AND public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "project_images_admin_delete" ON storage.objects;
CREATE POLICY "project_images_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-images' AND public.is_admin_or_manager(auth.uid()));
