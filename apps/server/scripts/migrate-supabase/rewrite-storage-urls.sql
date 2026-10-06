-- Point stored file URLs at the new Supabase project.
--
-- Replaces one URL prefix with another in every text / varchar / json / jsonb
-- column of the public schema. Dry-run by default: it only reports how many
-- rows each column would change, plus any references to the old host that
-- don't match the prefix (files in other buckets, which aren't moved).
--
--   psql "$NEW_DIRECT_URL" -v ON_ERROR_STOP=1 \
--     -v old_base='https://<old-ref>.supabase.co/storage/v1/object/public/media/' \
--     -v new_base='https://<new-ref>.supabase.co/storage/v1/object/public/media/' \
--     -v apply=0 \
--     -f scripts/migrate-supabase/rewrite-storage-urls.sql
--
-- Re-run with -v apply=1 to make the change (one transaction).

select
  set_config('migrate.old_base', :'old_base', false),
  set_config('migrate.new_base', :'new_base', false),
  set_config('migrate.apply', :'apply', false);

begin;

do $$
declare
  old_base text := current_setting('migrate.old_base');
  new_base text := current_setting('migrate.new_base');
  apply boolean := current_setting('migrate.apply') = '1';
  old_host text := split_part(split_part(old_base, '://', 2), '/', 1);
  col record;
  matched bigint;
  stray bigint;
  total bigint := 0;
  expr text;
begin
  if old_base = new_base or old_base not like 'https://%/' or new_base not like 'https://%/' then
    raise exception 'old_base and new_base must be different https:// prefixes ending in /';
  end if;

  for col in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'json', 'jsonb')
    order by c.table_name, c.column_name
  loop
    -- The column as text, so json/jsonb are matched and replaced the same way.
    expr := format('%I::text', col.column_name);

    execute format('select count(*) from public.%I where %s like %L',
      col.table_name, expr, '%' || old_base || '%') into matched;
    execute format('select count(*) from public.%I where %s like %L and %s not like %L',
      col.table_name, expr, '%' || old_host || '%', expr, '%' || old_base || '%') into stray;

    if matched > 0 then
      raise notice '%.%: % row(s)', col.table_name, col.column_name, matched;
      total := total + matched;
      if apply then
        execute format('update public.%I set %I = replace(%s, %L, %L)::%s where %s like %L',
          col.table_name, col.column_name, expr, old_base, new_base,
          case col.data_type when 'character varying' then 'varchar' else col.data_type end,
          expr, '%' || old_base || '%');
      end if;
    end if;
    if stray > 0 then
      raise notice '%.%: % row(s) reference % outside this bucket (left as is)',
        col.table_name, col.column_name, stray, old_host;
    end if;
  end loop;

  raise notice '% row(s) in total %', total,
    case when apply then 'rewritten' else 'would be rewritten (dry run)' end;
end $$;

commit;
