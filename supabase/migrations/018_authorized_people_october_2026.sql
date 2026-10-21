-- Directorio y roles autorizados para el acceso a BIOMET.
-- Los correos externos requieren ser invitados B2B en Microsoft Entra ID de Biomont.
begin;

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'apedraglio@biomont.com.pe', 'gcg'),
    ('Juan Carlos Amaro', 'jamaro@biomont.com.pe', 'gerente_responsable'),
    ('Claudia Urbina', 'curbina@biomont.com.pe', 'gcg'),
    ('Carmina Mercado', 'cmedrano@biomont.com.pe', 'gerente_responsable'),
    ('Julio De la Vega', 'jdelavega@biomont.com.pe', 'gerente_responsable'),
    ('Nathalie Mena', 'nmas@biomont.com.pe', 'gerente_responsable'),
    ('William Peña', 'wpena@biomont.com.pe', 'gerente_responsable'),
    ('Ivan Reyna', 'ireyna@biomont.com.pe', 'gerente_responsable'),
    ('Jesus Chulluni', 'jcusicuna@biomont.com.pe', 'gerente_responsable'),
    ('Carlos Huerta', 'chuerta@biomont.com.pe', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'aperez@biomont.com.ec', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'chiara.pedraglio@kunturpharma.pe', 'gerente_responsable')
)
insert into public.role_assignments (email, role)
select email, role from authorized_people
on conflict (email) do update set role = excluded.role, updated_at = now();

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'apedraglio@biomont.com.pe', 'gcg'),
    ('Juan Carlos Amaro', 'jamaro@biomont.com.pe', 'gerente_responsable'),
    ('Claudia Urbina', 'curbina@biomont.com.pe', 'gcg'),
    ('Carmina Mercado', 'cmedrano@biomont.com.pe', 'gerente_responsable'),
    ('Julio De la Vega', 'jdelavega@biomont.com.pe', 'gerente_responsable'),
    ('Nathalie Mena', 'nmas@biomont.com.pe', 'gerente_responsable'),
    ('William Peña', 'wpena@biomont.com.pe', 'gerente_responsable'),
    ('Ivan Reyna', 'ireyna@biomont.com.pe', 'gerente_responsable'),
    ('Jesus Chulluni', 'jcusicuna@biomont.com.pe', 'gerente_responsable'),
    ('Carlos Huerta', 'chuerta@biomont.com.pe', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'aperez@biomont.com.ec', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'chiara.pedraglio@kunturpharma.pe', 'gerente_responsable')
)
update public.profiles profile
set role = person.role, updated_at = now()
from authorized_people person
where lower(profile.email) = person.email;

with authorized_people(full_name, email, role) as (
  values
    ('Aldo Pedraglio', 'apedraglio@biomont.com.pe', 'gcg'),
    ('Juan Carlos Amaro', 'jamaro@biomont.com.pe', 'gerente_responsable'),
    ('Claudia Urbina', 'curbina@biomont.com.pe', 'gcg'),
    ('Carmina Mercado', 'cmedrano@biomont.com.pe', 'gerente_responsable'),
    ('Julio De la Vega', 'jdelavega@biomont.com.pe', 'gerente_responsable'),
    ('Nathalie Mena', 'nmas@biomont.com.pe', 'gerente_responsable'),
    ('William Peña', 'wpena@biomont.com.pe', 'gerente_responsable'),
    ('Ivan Reyna', 'ireyna@biomont.com.pe', 'gerente_responsable'),
    ('Jesus Chulluni', 'jcusicuna@biomont.com.pe', 'gerente_responsable'),
    ('Carlos Huerta', 'chuerta@biomont.com.pe', 'gerente_responsable'),
    ('Angel Pérez (Ecuador)', 'aperez@biomont.com.ec', 'gerente_responsable'),
    ('Chiara Pedraglio (Kuntur)', 'chiara.pedraglio@kunturpharma.pe', 'gerente_responsable')
)
insert into public.organization_people (full_name, email, role, active)
select full_name, email, role, true from authorized_people
on conflict (full_name) do update set email = excluded.email, role = excluded.role, active = true, updated_at = now();

commit;
