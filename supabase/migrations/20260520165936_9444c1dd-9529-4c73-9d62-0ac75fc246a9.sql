ALTER TABLE public.units
  ADD CONSTRAINT units_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;