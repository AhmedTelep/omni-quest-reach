
-- 1) Replace resident UPDATE policy on installments with column-restricted version via trigger
DROP POLICY IF EXISTS installments_resident_update_own ON public.installments;

CREATE POLICY installments_resident_update_own
ON public.installments
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.residents r WHERE r.id = installments.resident_id AND r.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.residents r WHERE r.id = installments.resident_id AND r.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.guard_resident_installment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_resident_owner boolean;
BEGIN
  -- Staff bypass: if caller is staff, allow anything
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.id = NEW.resident_id AND r.user_id = auth.uid()
  ) INTO is_resident_owner;

  IF NOT is_resident_owner THEN
    RETURN NEW; -- RLS will block; fall through
  END IF;

  -- Residents must not change financial / approval fields
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     OR NEW.confirmed_by_name IS DISTINCT FROM OLD.confirmed_by_name
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.resident_id IS DISTINCT FROM OLD.resident_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
  THEN
    RAISE EXCEPTION 'غير مسموح للساكن بتعديل هذه الحقول';
  END IF;

  -- Residents may only set status to pending_confirmation
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status <> 'pending_confirmation'
  THEN
    RAISE EXCEPTION 'الساكن يقدر فقط يضع الحالة بانتظار التأكيد';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_resident_installment_update ON public.installments;
CREATE TRIGGER trg_guard_resident_installment_update
BEFORE UPDATE ON public.installments
FOR EACH ROW
EXECUTE FUNCTION public.guard_resident_installment_update();

-- 2) Storage DELETE policies
-- receipts: staff can delete any; owner can delete their own (path prefix = uid)
CREATE POLICY "receipts_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND public.is_staff(auth.uid()));

CREATE POLICY "receipts_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "request_images_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'request-images' AND public.is_staff(auth.uid()));

CREATE POLICY "request_images_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) project-logos: restrict listing to staff. Public URLs still work for direct reads
--    (public bucket reads bypass RLS via the public URL).
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND qual LIKE '%project-logos%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "project_logos_staff_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'project-logos' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'project-logos' AND public.is_staff(auth.uid()));
