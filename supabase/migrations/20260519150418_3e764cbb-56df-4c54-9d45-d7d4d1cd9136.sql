-- Defense-in-depth: tighten resident UPDATE policy on installments
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
    AND (payment_status IS NULL OR payment_status = 'pending_confirmation')
    AND confirmed_at IS NULL
    AND confirmed_by_name IS NULL
    AND rejection_reason IS NULL
  );

-- Storage: add staff UPDATE policy on request-images for parity with receipts
CREATE POLICY request_images_staff_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'request-images' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'request-images' AND public.is_staff(auth.uid()));