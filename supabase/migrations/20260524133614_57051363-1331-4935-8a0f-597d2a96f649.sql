
-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_self_delete ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
-- no INSERT policy: only SECURITY DEFINER functions/triggers insert

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  -- 'all' | 'residents' | 'employees' | 'role:<role>' | 'project:<uuid>'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_staff_select ON public.announcements
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY announcements_resident_select ON public.announcements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.user_id = auth.uid())
  );
CREATE POLICY announcements_admin_write ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ============ DEDUP ============
CREATE TABLE public.notification_dedup (
  dedup_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_dedup ENABLE ROW LEVEL SECURITY;
-- no policies; only SECURITY DEFINER functions touch it

-- ============ HELPER: insert notification ============
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _body text, _link text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (_user_id, _type, _title, _body, _link, COALESCE(_metadata,'{}'::jsonb));
END;
$$;

-- ============ TRIGGER: installments ============
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
    -- notify resident of new installment
    PERFORM public.notify_user(
      resident_user, 'installment_new',
      'قسط جديد',
      'تم إضافة قسط بقيمة ' || NEW.amount::text || ' ج.م',
      '/my-installments',
      jsonb_build_object('installment_id', NEW.id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'pending_confirmation' THEN
      -- notify accountants + admins + managers
      FOR acc_user IN
        SELECT user_id FROM public.user_roles
        WHERE role IN ('admin','manager','accountant')
      LOOP
        PERFORM public.notify_user(
          acc_user, 'installment_pending_review',
          'إيصال جديد بانتظار التأكيد',
          'الساكن ' || COALESCE(resident_name,'') || ' رفع إيصال قسط بقيمة ' || NEW.amount::text,
          '/installments',
          jsonb_build_object('installment_id', NEW.id)
        );
      END LOOP;
    ELSIF NEW.payment_status = 'confirmed' THEN
      PERFORM public.notify_user(
        resident_user, 'installment_confirmed',
        'تم تأكيد قسطك',
        'تم تأكيد دفع القسط بقيمة ' || NEW.amount::text || ' ج.م',
        '/my-installments',
        jsonb_build_object('installment_id', NEW.id)
      );
    ELSIF NEW.payment_status = 'rejected' THEN
      PERFORM public.notify_user(
        resident_user, 'installment_rejected',
        'تم رفض إيصال القسط',
        COALESCE(NEW.rejection_reason,'يرجى إعادة رفع الإيصال'),
        '/my-installments',
        jsonb_build_object('installment_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER installments_notify_ins AFTER INSERT ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.trg_installments_notify();
CREATE TRIGGER installments_notify_upd AFTER UPDATE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.trg_installments_notify();

-- ============ TRIGGER: maintenance_requests ============
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
        '/requests',
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
      '/my-requests',
      jsonb_build_object('request_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER requests_notify_ins AFTER INSERT ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_requests_notify();
CREATE TRIGGER requests_notify_upd AFTER UPDATE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_requests_notify();

-- ============ TRIGGER: residents ============
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
      '/residents',
      jsonb_build_object('resident_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER residents_notify_ins AFTER INSERT ON public.residents
FOR EACH ROW EXECUTE FUNCTION public.trg_residents_notify();

-- ============ TRIGGER: announcements ============
CREATE OR REPLACE FUNCTION public.trg_announcements_fanout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user uuid;
  role_filter text;
  project_filter uuid;
BEGIN
  IF NEW.audience = 'all' THEN
    FOR target_user IN
      SELECT id FROM auth.users
    LOOP
      PERFORM public.notify_user(target_user, 'announcement', NEW.title, NEW.body, '/notifications', jsonb_build_object('announcement_id', NEW.id));
    END LOOP;
  ELSIF NEW.audience = 'residents' THEN
    FOR target_user IN
      SELECT DISTINCT user_id FROM public.residents WHERE user_id IS NOT NULL
    LOOP
      PERFORM public.notify_user(target_user, 'announcement', NEW.title, NEW.body, '/notifications', jsonb_build_object('announcement_id', NEW.id));
    END LOOP;
  ELSIF NEW.audience = 'employees' THEN
    FOR target_user IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE role IN ('admin','manager','sales_manager','sales','accountant')
    LOOP
      PERFORM public.notify_user(target_user, 'announcement', NEW.title, NEW.body, '/notifications', jsonb_build_object('announcement_id', NEW.id));
    END LOOP;
  ELSIF NEW.audience LIKE 'role:%' THEN
    role_filter := substring(NEW.audience FROM 6);
    FOR target_user IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role::text = role_filter
    LOOP
      PERFORM public.notify_user(target_user, 'announcement', NEW.title, NEW.body, '/notifications', jsonb_build_object('announcement_id', NEW.id));
    END LOOP;
  ELSIF NEW.audience LIKE 'project:%' THEN
    project_filter := substring(NEW.audience FROM 9)::uuid;
    FOR target_user IN
      SELECT DISTINCT user_id FROM public.residents
      WHERE project_id = project_filter AND user_id IS NOT NULL
    LOOP
      PERFORM public.notify_user(target_user, 'announcement', NEW.title, NEW.body, '/notifications', jsonb_build_object('announcement_id', NEW.id));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER announcements_fanout_ins AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.trg_announcements_fanout();

-- ============ CRON: due-soon / overdue ============
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
    SELECT i.id, i.amount, i.due_date, i.resident_id, res.user_id AS resident_user, res.name AS resident_name
    FROM public.installments i
    JOIN public.residents res ON res.id = i.resident_id
    WHERE i.due_date IS NOT NULL
      AND (i.payment_status IS NULL OR i.payment_status NOT IN ('confirmed','pending_confirmation'))
      AND i.due_date::date <= (CURRENT_DATE + INTERVAL '3 days')
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
      r.resident_user, ntype, msg_title, msg_body, '/my-installments',
      jsonb_build_object('installment_id', r.id)
    );
  END LOOP;
END;
$$;

-- cleanup old dedup keys (>30d)
CREATE OR REPLACE FUNCTION public.cleanup_notification_dedup()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.notification_dedup WHERE created_at < now() - INTERVAL '30 days';
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'installment-reminders-daily',
  '0 8 * * *',
  $$ SELECT public.run_installment_reminders(); SELECT public.cleanup_notification_dedup(); $$
);
