
REVOKE ALL ON FUNCTION public.gen_installment_serial() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_payment_serial() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_installment_totals(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_payments_recompute() FROM public, anon, authenticated;
