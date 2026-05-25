
-- Update notification triggers and functions to deep-link to entities

CREATE OR REPLACE FUNCTION public.trg_installments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resident_user uuid;
  resident_name text;
  acc_user uuid;
BEGIN
  SELECT user_id, name INTO resident_user, resident_name
  FROM public.residents WHERE id = NEW.resident_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(
      resident_user, 'installment_new',
      'قسط جديد',
      'تم إضافة قسط بقيمة ' || NEW.amount::text || ' ج.م',
      '/my-installments#inst-' || NEW.id::text,
      jsonb_build_object('installment_id', NEW.id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'pending_confirmation' THEN
      FOR acc_user IN
        SELECT user_id FROM public.user_roles
        WHERE role IN ('admin','manager','accountant')
      LOOP
        PERFORM public.notify_user(
          acc_user, 'installment_pending_review',
          'إيصال جديد بانتظار التأكيد',
          'الساكن ' || COALESCE(resident_name,'') || ' رفع إيصال قسط بقيمة ' || NEW.amount::text,
          '/residents/' || NEW.resident_id::text || '#inst-' || NEW.id::text,
          jsonb_build_object('installment_id', NEW.id, 'resident_id', NEW.resident_id)
        );
      END LOOP;
    ELSIF NEW.payment_status = 'confirmed' THEN
      PERFORM public.notify_user(
        resident_user, 'installment_confirmed',
        'تم تأكيد قسطك',
        'تم تأكيد دفع القسط بقيمة ' || NEW.amount::text || ' ج.م',
        '/my-installments#inst-' || NEW.id::text,
        jsonb_build_object('installment_id', NEW.id)
      );
    ELSIF NEW.payment_status = 'rejected' THEN
      PERFORM public.notify_user(
        resident_user, 'installment_rejected',
        'تم رفض إيصال القسط',
        COALESCE(NEW.rejection_reason,'يرجى إعادة رفع الإيصال'),
        '/my-installments#inst-' || NEW.id::text,
        jsonb_build_object('installment_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_requests_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resident_user uuid;
  resident_name text;
  staff_user uuid;
BEGIN
  SELECT user_id, name INTO resident_user, resident_name
  FROM public.residents WHERE id = NEW.resident_id;

  IF TG_OP = 'INSERT' THEN
    FOR staff_user IN
      SELECT user_id FROM public.user_roles
      WHERE role IN ('admin','manager','sales_manager','sales')
    LOOP
      PERFORM public.notify_user(
        staff_user, 'request_new',
        'طلب صيانة جديد',
        'من ' || COALESCE(resident_name,'') || ' — ' || NEW.service_type,
        '/requests#req-' || NEW.id::text,
        jsonb_build_object('request_id', NEW.id)
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(
      resident_user, 'request_status_changed',
      'تحديث حالة طلب الصيانة',
      'أصبحت حالة طلبك: ' || NEW.status::text,
      '/my-requests#req-' || NEW.id::text,
      jsonb_build_object('request_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_residents_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  staff_user uuid;
BEGIN
  FOR staff_user IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin','manager')
  LOOP
    PERFORM public.notify_user(
      staff_user, 'resident_added',
      'ساكن جديد',
      'تم إضافة الساكن ' || NEW.name || ' في الوحدة ' || NEW.unit_number,
      '/residents/' || NEW.id::text,
      jsonb_build_object('resident_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Update late-fee + reminders to deep-link
CREATE OR REPLACE FUNCTION public.apply_installment_late_fees()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  eff_type text;
  eff_value numeric;
  eff_grace integer;
  eff_recur text;
  fee_increment numeric;
  should_apply boolean;
BEGIN
  FOR r IN
    SELECT i.id, i.amount, i.due_date, i.resident_id, i.late_fee_apply_count, i.late_fee_applied_at,
           res.user_id AS resident_user_id,
           COALESCE(i.late_fee_type_override, s.late_fee_type, 'none') AS lf_type,
           COALESCE(i.late_fee_value_override, s.late_fee_value, 0) AS lf_value,
           COALESCE(i.late_fee_grace_days_override, s.late_fee_grace_days, 0) AS lf_grace,
           COALESCE(i.late_fee_recurrence_override, s.late_fee_recurrence, 'once') AS lf_recur
    FROM public.installments i
    JOIN public.residents res ON res.id = i.resident_id
    LEFT JOIN public.installment_schedules s ON s.id = i.schedule_id
    WHERE i.due_date IS NOT NULL
      AND (i.payment_status IS NULL OR i.payment_status NOT IN ('confirmed','pending_confirmation'))
  LOOP
    eff_type := r.lf_type;
    eff_value := r.lf_value;
    eff_grace := r.lf_grace;
    eff_recur := r.lf_recur;

    IF eff_type = 'none' OR eff_value <= 0 THEN CONTINUE; END IF;
    IF r.due_date::date + (eff_grace || ' days')::interval > now() THEN CONTINUE; END IF;

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
    ELSE
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
      '/my-installments#inst-' || r.id::text,
      jsonb_build_object('installment_id', r.id, 'fee', fee_increment)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_installment_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  dkey text;
  msg_title text;
  msg_body text;
  ntype text;
BEGIN
  FOR r IN
    SELECT i.id, i.amount, i.due_date, i.resident_id,
           res.user_id AS resident_user, res.name AS resident_name
    FROM public.installments i
    JOIN public.residents res ON res.id = i.resident_id
    LEFT JOIN public.installment_schedules s ON s.id = i.schedule_id
    WHERE i.due_date IS NOT NULL
      AND (i.payment_status IS NULL OR i.payment_status NOT IN ('confirmed','pending_confirmation'))
      AND i.due_date::date <= (CURRENT_DATE + (COALESCE(i.reminder_days_before_override, s.reminder_days_before, 3) || ' days')::interval)::date
  LOOP
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
      r.resident_user, ntype, msg_title, msg_body,
      '/my-installments#inst-' || r.id::text,
      jsonb_build_object('installment_id', r.id)
    );
  END LOOP;
END;
$$;
