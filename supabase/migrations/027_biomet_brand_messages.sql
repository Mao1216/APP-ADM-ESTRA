-- Actualiza la marca en mensajes de funciones ya instaladas.
-- No modifica usuarios, permisos ni datos operativos.
begin;
do $$
declare
  function_signature text;
  function_oid regprocedure;
  definition text;
begin
  foreach function_signature in array array[
    'public.handle_new_user()',
    'public.assign_indicator_reporter(bigint,text)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is not null then
      definition := pg_get_functiondef(function_oid);
      definition := replace(replace(definition, 'Bionexora', 'BIOMET'), 'BIONEXORA', 'BIOMET');
      execute definition;
    end if;
  end loop;
end;
$$;
commit;
