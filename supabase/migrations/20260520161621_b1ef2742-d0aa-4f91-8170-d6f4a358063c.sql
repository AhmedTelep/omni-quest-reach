CREATE UNIQUE INDEX IF NOT EXISTS residents_project_unit_unique
ON public.residents (project_id, unit_number)
WHERE project_id IS NOT NULL;