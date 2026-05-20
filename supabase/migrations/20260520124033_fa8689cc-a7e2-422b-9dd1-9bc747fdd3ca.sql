-- Make ahmed4telep@gmail.com the only default admin
DELETE FROM public.user_roles WHERE role = 'admin' AND user_id <> '8d9cc456-d0ba-409b-b3de-5282bc6fb798';

INSERT INTO public.user_roles (user_id, role)
VALUES ('8d9cc456-d0ba-409b-b3de-5282bc6fb798', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (id, full_name)
VALUES ('8d9cc456-d0ba-409b-b3de-5282bc6fb798', 'Ahmed Telep')
ON CONFLICT (id) DO NOTHING;