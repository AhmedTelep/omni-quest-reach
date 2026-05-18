
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'manager',
  'sales_manager',
  'sales',
  'accountant',
  'resident'
);

CREATE TYPE public.request_status AS ENUM ('open', 'in_progress', 'completed');
CREATE TYPE public.payment_status AS ENUM ('pending_confirmation', 'confirmed', 'rejected');

-- =====================================================
-- HELPER: updated_at trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- PROFILES (general user info)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- USER ROLES (separate table, NEVER on profiles)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','manager','sales_manager','sales','accountant')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager')
  )
$$;

-- =====================================================
-- PROJECTS
-- =====================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  logo TEXT,
  color TEXT NOT NULL DEFAULT '#1d4ed8',
  project_link TEXT,
  total_units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- SERVICES
-- =====================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'wrench',
  color TEXT NOT NULL DEFAULT '#6b7280',
  bg_color TEXT NOT NULL DEFAULT '#f3f4f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- EMPLOYEES
-- =====================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RESIDENTS
-- =====================================================
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  unit_link TEXT,
  unit_price NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_residents_project ON public.residents(project_id);
CREATE INDEX idx_residents_user ON public.residents(user_id);

-- =====================================================
-- MAINTENANCE REQUESTS
-- =====================================================
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  notes TEXT,
  image_url TEXT,
  preferred_date TIMESTAMPTZ,
  status public.request_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_requests_resident ON public.maintenance_requests(resident_id);
CREATE INDEX idx_requests_project ON public.maintenance_requests(project_id);
CREATE INDEX idx_requests_status ON public.maintenance_requests(status);

-- =====================================================
-- INSTALLMENTS
-- =====================================================
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  payment_status public.payment_status,
  paid_by_name TEXT,
  confirmed_by_name TEXT,
  confirmed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_installments_resident ON public.installments(resident_id);
CREATE INDEX idx_installments_project ON public.installments(project_id);
CREATE INDEX idx_installments_status ON public.installments(payment_status);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PROFILES
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- USER_ROLES
CREATE POLICY "user_roles_self_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- PROJECTS — staff can see all, residents see only their own project
CREATE POLICY "projects_staff_select" ON public.projects
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "projects_resident_select_own" ON public.projects
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.user_id = auth.uid() AND r.project_id = projects.id)
  );
CREATE POLICY "projects_admin_write" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- SERVICES — everyone authenticated can read
CREATE POLICY "services_authenticated_select" ON public.services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_admin_write" ON public.services
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- EMPLOYEES
CREATE POLICY "employees_self_select" ON public.employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "employees_admin_write" ON public.employees
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- RESIDENTS
CREATE POLICY "residents_staff_select" ON public.residents
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "residents_self_select" ON public.residents
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "residents_staff_write" ON public.residents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'sales_manager') OR
    public.has_role(auth.uid(), 'sales')
  );
CREATE POLICY "residents_staff_update" ON public.residents
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'sales_manager')
  );
CREATE POLICY "residents_admin_delete" ON public.residents
  FOR DELETE TO authenticated
  USING (public.is_admin_or_manager(auth.uid()));

-- MAINTENANCE REQUESTS
CREATE POLICY "requests_staff_select" ON public.maintenance_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "requests_resident_select_own" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.id = maintenance_requests.resident_id AND r.user_id = auth.uid()
  ));
CREATE POLICY "requests_resident_insert_own" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.id = maintenance_requests.resident_id AND r.user_id = auth.uid()
  ));
CREATE POLICY "requests_staff_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "requests_admin_delete" ON public.maintenance_requests
  FOR DELETE TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- INSTALLMENTS
CREATE POLICY "installments_staff_select" ON public.installments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "installments_resident_select_own" ON public.installments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.id = installments.resident_id AND r.user_id = auth.uid()
  ));
CREATE POLICY "installments_staff_insert" ON public.installments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'sales_manager')
  );
CREATE POLICY "installments_staff_update" ON public.installments
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "installments_admin_delete" ON public.installments
  FOR DELETE TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- =====================================================
-- TRIGGER: auto-create profile on new user
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.installments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.residents;

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('receipts', 'receipts', false),
  ('request-images', 'request-images', false),
  ('project-logos', 'project-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — receipts (private)
CREATE POLICY "receipts_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.is_staff(auth.uid()));
CREATE POLICY "receipts_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "receipts_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND public.is_staff(auth.uid()));
CREATE POLICY "receipts_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND public.is_staff(auth.uid()));

-- request-images (private)
CREATE POLICY "request_images_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'request-images' AND public.is_staff(auth.uid()));
CREATE POLICY "request_images_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "request_images_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'request-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- project-logos (public read)
CREATE POLICY "project_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-logos');
CREATE POLICY "project_logos_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-logos' AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "project_logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-logos' AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "project_logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-logos' AND public.is_admin_or_manager(auth.uid()));

-- =====================================================
-- SEED: default service types
-- =====================================================
INSERT INTO public.services (slug, name_ar, name_en, icon, color, bg_color) VALUES
  ('plumbing', 'سباكة', 'Plumbing', 'wrench', '#2563eb', '#dbeafe'),
  ('electrical', 'كهرباء', 'Electrical', 'zap', '#eab308', '#fef3c7'),
  ('cleaning', 'نظافة', 'Cleaning', 'sparkles', '#10b981', '#d1fae5'),
  ('carpentry', 'نجارة', 'Carpentry', 'hammer', '#a16207', '#fef3c7'),
  ('pest_control', 'مكافحة حشرات', 'Pest Control', 'bug', '#dc2626', '#fee2e2'),
  ('satellite', 'ستالايت', 'Satellite', 'satellite-dish', '#7c3aed', '#ede9fe')
ON CONFLICT (slug) DO NOTHING;
