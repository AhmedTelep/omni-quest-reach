
REVOKE EXECUTE ON FUNCTION public.trg_installments_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_requests_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_residents_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_installment_late_fees() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_installment_reminders() FROM PUBLIC, anon, authenticated;
