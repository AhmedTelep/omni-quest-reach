
-- Restore EXECUTE on SECURITY DEFINER helpers used by triggers and RLS.
-- Previous migrations revoked these, which broke any UPDATE/INSERT that fires
-- the recompute / notify / guard triggers, and broke RLS checks calling is_staff().
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_installment_totals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_payments_recompute() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_installments_notify() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_requests_notify() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_residents_notify() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_announcements_fanout() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_resident_installment_update() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_payment_serial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_installment_serial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
