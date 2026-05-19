
-- Residents can upload receipts inside a folder named with their auth user id
CREATE POLICY "receipts_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Residents can update their own installment row (to attach receipt + paid info)
CREATE POLICY "installments_resident_update_own" ON public.installments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = installments.resident_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = installments.resident_id AND r.user_id = auth.uid()
    )
  );
