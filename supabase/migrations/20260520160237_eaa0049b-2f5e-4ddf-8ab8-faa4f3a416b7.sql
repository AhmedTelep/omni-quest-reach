-- Units table: catalog of units per project, managed independently of residents
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  unit_number text NOT NULL,
  floor text,
  area numeric,
  price numeric,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, unit_number)
);

CREATE INDEX idx_units_project ON public.units(project_id);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY units_staff_select ON public.units
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY units_resident_select_own_project ON public.units
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.user_id = auth.uid() AND r.project_id = units.project_id
  ));

CREATE POLICY units_admin_write ON public.units
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE TRIGGER units_set_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();