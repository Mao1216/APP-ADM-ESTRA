-- Correos corporativos asociados al directorio de personas.
insert into public.organization_people (full_name, email, role) values
  ('Claudia Urbina', 'curbina@biomont.com.pe', 'gerente_responsable'),
  ('Manuel Olin', 'molin@biomont.com.pe', 'gerente_responsable'),
  ('Jhon Cardenas', 'jcardenas@biomont.com.pe', 'gerente_responsable')
on conflict (full_name) do update set
  email = excluded.email,
  active = true,
  updated_at = now();
