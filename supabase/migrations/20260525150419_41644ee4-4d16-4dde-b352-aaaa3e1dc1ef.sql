
-- ========= 1. SERIALS for installments =========
CREATE SEQUENCE IF NOT EXISTS public.installments_serial_seq;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS serial text;

CREATE OR REPLACE FUNCTION public.gen_installment_serial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.serial IS NULL OR NEW.serial = '' THEN
    NEW.serial := 'INS-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.installments_serial_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_installments_serial ON public.installments;
CREATE TRIGGER trg_installments_serial BEFORE INSERT ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.gen_installment_serial();

-- Backfill existing rows
UPDATE public.installments SET serial = 'INS-' || to_char(created_at, 'YYYYMM') || '-' || lpad(nextval('public.installments_serial_seq')::text, 6, '0')
WHERE serial IS NULL;

ALTER TABLE public.installments ALTER COLUMN serial SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS installments_serial_unique ON public.installments(serial);

-- ========= 2. Partial payments tracking =========
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS schedule_id uuid;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS installment_index integer;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS installments_total integer;

-- Add 'partial' to payment_status enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.payment_status'::regtype AND enumlabel = 'partial') THEN
    ALTER TYPE public.payment_status ADD VALUE 'partial';
  END IF;
END $$;

-- ========= 3. installment_schedules =========
CREATE TABLE IF NOT EXISTS public.installment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL,
  project_id uuid NOT NULL,
  total_amount numeric NOT NULL,
  count integer NOT NULL CHECK (count > 0 AND count <= 600),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','yearly','weekly')),
  start_date date NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.installment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_staff_select" ON public.installment_schedules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "schedules_resident_select" ON public.installment_schedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.id = resident_id AND r.user_id = auth.uid()));
CREATE POLICY "schedules_staff_write" ON public.installment_schedules FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ========= 4. installment_payments =========
CREATE SEQUENCE IF NOT EXISTS public.installment_payments_serial_seq;

CREATE TABLE IF NOT EXISTS public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  serial text NOT NULL UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  receipt_url text,
  paid_at timestamptz,
  paid_by_name text,
  payment_status text NOT NULL DEFAULT 'pending_confirmation' CHECK (payment_status IN ('pending_confirmation','confirmed','rejected')),
  confirmed_at timestamptz,
  confirmed_by_name text,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS installment_payments_installment_idx ON public.installment_payments(installment_id);

CREATE OR REPLACE FUNCTION public.gen_payment_serial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.serial IS NULL OR NEW.serial = '' THEN
    NEW.serial := 'PAY-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.installment_payments_serial_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payments_serial ON public.installment_payments;
CREATE TRIGGER trg_payments_serial BEFORE INSERT ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.gen_payment_serial();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.installment_payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_staff_select" ON public.installment_payments FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "payments_resident_select_own" ON public.installment_payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.installments i JOIN public.residents r ON r.id = i.resident_id
               WHERE i.id = installment_id AND r.user_id = auth.uid()));

CREATE POLICY "payments_resident_insert_own" ON public.installment_payments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.installments i JOIN public.residents r ON r.id = i.resident_id
                    WHERE i.id = installment_id AND r.user_id = auth.uid())
            AND payment_status = 'pending_confirmation'
            AND confirmed_at IS NULL);

CREATE POLICY "payments_staff_insert" ON public.installment_payments FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "payments_staff_update" ON public.installment_payments FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "payments_admin_delete" ON public.installment_payments FOR DELETE TO authenticated
USING (public.is_admin_or_manager(auth.uid()));

-- ========= 5. Recompute installment paid_amount + status =========
CREATE OR REPLACE FUNCTION public.recompute_installment_totals(_installment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_confirmed numeric;
  has_pending boolean;
  inst_amount numeric;
  new_status public.payment_status;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO total_confirmed
  FROM public.installment_payments
  WHERE installment_id = _installment_id AND payment_status = 'confirmed';

  SELECT EXISTS(SELECT 1 FROM public.installment_payments
                WHERE installment_id = _installment_id AND payment_status = 'pending_confirmation')
  INTO has_pending;

  SELECT amount INTO inst_amount FROM public.installments WHERE id = _installment_id;

  IF total_confirmed >= inst_amount THEN
    new_status := 'confirmed';
  ELSIF total_confirmed > 0 THEN
    new_status := 'partial';
  ELSIF has_pending THEN
    new_status := 'pending_confirmation';
  ELSE
    new_status := NULL;
  END IF;

  UPDATE public.installments
  SET paid_amount = total_confirmed,
      payment_status = new_status,
      paid_at = CASE WHEN new_status = 'confirmed' THEN COALESCE(paid_at, now()) ELSE paid_at END
  WHERE id = _installment_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_payments_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_installment_totals(OLD.installment_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_installment_totals(NEW.installment_id);
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_payments_after ON public.installment_payments;
CREATE TRIGGER trg_payments_after AFTER INSERT OR UPDATE OR DELETE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_recompute();
