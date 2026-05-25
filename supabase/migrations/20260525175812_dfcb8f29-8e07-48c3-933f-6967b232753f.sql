
-- 1) Schedule-level late fee + reminder defaults
ALTER TABLE public.installment_schedules
  ADD COLUMN IF NOT EXISTS late_fee_type text NOT NULL DEFAULT 'none' CHECK (late_fee_type IN ('none','fixed','percent')),
  ADD COLUMN IF NOT EXISTS late_fee_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_grace_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_recurrence text NOT NULL DEFAULT 'once' CHECK (late_fee_recurrence IN ('once','daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 3;

-- 2) Installment-level fields (accumulated late fee + optional overrides)
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS late_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_fee_apply_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_type_override text CHECK (late_fee_type_override IN ('none','fixed','percent')),
  ADD COLUMN IF NOT EXISTS late_fee_value_override numeric,
  ADD COLUMN IF NOT EXISTS late_fee_grace_days_override integer,
  ADD COLUMN IF NOT EXISTS late_fee_recurrence_override text CHECK (late_fee_recurrence_override IN ('once','daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS reminder_days_before_override integer;

-- 3) Apply late fees function
CREATE OR REPLACE FUNCTION public.apply_installment_late_fees()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  eff_type text;
  eff_value numeric;
  eff_grace integer;
  eff_recur text;
  fee_increment numeric;
  should_apply boolean;
  days_overdue integer;
  resident_user uuid;
BEGIN
  FOR r IN
    SELECT i.*, s.late_fee_type AS s_type, s.late_fee_value AS s_value,
           s.late_fee_grace_days AS s_grace, s.late_fee_recurrence AS s_recur,
           res.user_id AS resident_user_id
    FROM public.installments i
    LEFT JOIN public.installment_schedules s ON s.id = i.schedule_id
    JOIN public.residents res ON res.id = i.resident_id
    WHERE i.due_date IS NOT NULL
      AND (i.payment_status IS NULL OR i.payment_status NOT IN ('confirmed'))
  LOOP
    eff_type  := COALESCE(r.late_fee_type_override, r.s_type, 'none');
    IF eff_type = 'none' THEN CONTINUE; END IF;
    eff_value := COALESCE(r.late_fee_value_override, r.s_value, 0);
    IF eff_value <= 0 THEN CONTINUE; END IF;
    eff_grace := COALESCE(r.late_fee_grace_days_override, r.s_grace, 0);
    eff_recur := COALESCE(r.late_fee_recurrence_override, r.s_recur, 'once');

    days_overdue := (CURRENT_DATE - r.due_date::date) - eff_grace;
    IF days_overdue < 0 THEN CONTINUE; END IF;

    -- Determine if a new application is due
    should_apply := false;
    IF eff_recur = 'once' THEN
      should_apply := (r.late_fee_apply_count = 0);
    ELSIF eff_recur = 'daily' THEN
      should_apply := (r.late_fee_applied_at IS NULL) OR (r.late_fee_applied_at::date < CURRENT_DATE);
    ELSIF eff_recur = 'weekly' THEN
      should_apply := (r.late_fee_applied_at IS NULL) OR (r.late_fee_applied_at < (now() - INTERVAL '7 days'));
    ELSIF eff_recur = 'monthly' THEN
      should_apply := (r.late_fee_applied_at IS NULL) OR (r.late_fee_applied_at < (now() - INTERVAL '30 days'));
    END IF;

    IF NOT should_apply THEN CONTINUE; END IF;

    IF eff_type = 'fixed' THEN
      fee_increment := eff_value;
    ELSE -- percent of installment amount
      fee_increment := round((r.amount * eff_value / 100.0)::numeric, 2);
    END IF;

    IF fee_increment <= 0 THEN CONTINUE; END IF;

    UPDATE public.installments
    SET late_fee_amount     = COALESCE(late_fee_amount, 0) + fee_increment,
        late_fee_applied_at = now(),
        late_fee_apply_count = COALESCE(late_fee_apply_count, 0) + 1
    WHERE id = r.id;

    PERFORM public.notify_user(
      r.resident_user_id, 'installment_late_fee',
      'تم احتساب غرامة تأخير',
      'تم إضافة غرامة بقيمة ' || fee_increment::text || ' ج.م على القسط المستحق بتاريخ ' || r.due_date::date::text,
      '/my-installments',
      jsonb_build_object('installment_id', r.id, 'fee', fee_increment)
    );
  END LOOP;
END;
$$;

-- 4) Updated reminder function honoring per-schedule days-before
CREATE OR REPLACE FUNCTION public.run_installment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  dkey text;
  msg_title text;
  msg_body text;
  ntype text;
  days_before integer;
BEGIN
  FOR r IN
    SELECT i.id, i.amount, i.due_date, i.resident_id,
           res.user_id AS resident_user, res.name AS resident_name,
           COALESCE(i.reminder_days_before_override, s.reminder_days_before, 3) AS days_before
    FROM public.installments i
    JOIN public.residents res ON res.id = i.resident_id
    LEFT JOIN public.installment_schedules s ON s.id = i.schedule_id
    WHERE i.due_date IS NOT NULL
      AND (i.payment_status IS NULL OR i.payment_status NOT IN ('confirmed','pending_confirmation'))
      AND i.due_date::date <= (CURRENT_DATE + (COALESCE(i.reminder_days_before_override, s.reminder_days_before, 3) || ' days')::interval)::date
  LOOP
    days_before := r.days_before;
    IF r.due_date::date < CURRENT_DATE THEN
      ntype := 'installment_overdue';
      msg_title := 'قسط متأخر';
      msg_body := 'قسط بقيمة ' || r.amount::text || ' ج.م متأخر منذ ' || r.due_date::date::text;
    ELSE
      ntype := 'installment_due_soon';
      msg_title := 'قسط مستحق قريباً';
      msg_body := 'قسط بقيمة ' || r.amount::text || ' ج.م مستحق بتاريخ ' || r.due_date::date::text;
    END IF;
    dkey := ntype || ':' || r.id::text || ':' || CURRENT_DATE::text;
    BEGIN
      INSERT INTO public.notification_dedup(dedup_key) VALUES (dkey);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
    PERFORM public.notify_user(
      r.resident_user, ntype, msg_title, msg_body, '/my-installments',
      jsonb_build_object('installment_id', r.id)
    );
  END LOOP;
END;
$$;

-- 5) Daily cron: apply fees + send reminders (08:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('daily-installment-late-fees','daily-installment-reminders');
    PERFORM cron.schedule('daily-installment-late-fees', '0 8 * * *', $cron$ SELECT public.apply_installment_late_fees(); $cron$);
    PERFORM cron.schedule('daily-installment-reminders', '5 8 * * *', $cron$ SELECT public.run_installment_reminders(); $cron$);
  END IF;
END $$;
