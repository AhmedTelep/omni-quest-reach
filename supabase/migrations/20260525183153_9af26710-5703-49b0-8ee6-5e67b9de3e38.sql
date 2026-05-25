
-- A1: notification_dedup — explicit deny-all policy (access only via SECURITY DEFINER)
CREATE POLICY "notification_dedup_no_access" ON public.notification_dedup
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- A2: receipts bucket — allow owner UPDATE on their own folder
CREATE POLICY "receipts_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- A3: project-images UPDATE — add WITH CHECK to prevent bucket_id swap
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_images_admin_update') THEN
    EXECUTE 'DROP POLICY "project_images_admin_update" ON storage.objects';
  END IF;
END$$;

CREATE POLICY "project_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-images' AND public.is_admin_or_manager(auth.uid()))
  WITH CHECK (bucket_id = 'project-images' AND public.is_admin_or_manager(auth.uid()));

-- Same hardening for project-logos UPDATE if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_logos_admin_update') THEN
    EXECUTE 'DROP POLICY "project_logos_admin_update" ON storage.objects';
    EXECUTE 'CREATE POLICY "project_logos_admin_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = ''project-logos'' AND public.is_admin_or_manager(auth.uid()))
      WITH CHECK (bucket_id = ''project-logos'' AND public.is_admin_or_manager(auth.uid()))';
  END IF;
END$$;

-- B: Revoke EXECUTE on SECURITY DEFINER functions from public/authenticated
-- These are called by triggers or pg_cron only; users must not invoke them directly.
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_installment_totals(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.apply_installment_late_fees() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.run_installment_reminders() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_notification_dedup() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.guard_resident_installment_update() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trg_announcements_fanout() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trg_residents_notify() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trg_installments_notify() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trg_requests_notify() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trg_payments_recompute() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.gen_installment_serial() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.gen_payment_serial() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, authenticated, anon;
-- Keep has_role / is_staff / is_admin_or_manager callable: they're used in RLS policies and safe (read-only role check for the caller)
