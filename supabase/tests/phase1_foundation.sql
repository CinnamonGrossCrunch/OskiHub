-- Disposable isolated v2/local Supabase database only. Never production/v1.
-- Run using: psql "$FOUNDATION_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/phase1_foundation.sql
-- Everything below, including synthetic fixtures, is rolled back.
begin;

create temporary table foundation_test_ids (
  table_name text not null,
  id uuid not null,
  owner_user_id uuid,
  is_public boolean not null
) on commit drop;
insert into foundation_test_ids values
  ('courses', 'f1000000-0000-4000-8000-000000000020', null, true),
  ('course_offerings', 'f1000000-0000-4000-8000-000000000030', null, true),
  ('course_sections', 'f1000000-0000-4000-8000-000000000040', null, true),
  ('user_enrollments', 'f1000000-0000-4000-8000-000000000050', 'f1000000-0000-4000-8000-000000000001', false),
  ('user_enrollments', 'f1000000-0000-4000-8000-000000000051', 'f1000000-0000-4000-8000-000000000002', false),
  ('assignments', 'f1000000-0000-4000-8000-000000000060', 'f1000000-0000-4000-8000-000000000001', false),
  ('assignments', 'f1000000-0000-4000-8000-000000000061', 'f1000000-0000-4000-8000-000000000002', false),
  ('personal_events', 'f1000000-0000-4000-8000-000000000070', 'f1000000-0000-4000-8000-000000000001', false),
  ('personal_events', 'f1000000-0000-4000-8000-000000000071', 'f1000000-0000-4000-8000-000000000002', false),
  ('source_observations', 'f1000000-0000-4000-8000-000000000080', null, true),
  ('source_observations', 'f1000000-0000-4000-8000-000000000081', 'f1000000-0000-4000-8000-000000000001', false),
  ('source_observations', 'f1000000-0000-4000-8000-000000000082', 'f1000000-0000-4000-8000-000000000002', false),
  ('resolution_rules', 'f1000000-0000-4000-8000-000000000090', null, true),
  ('resolution_rules', 'f1000000-0000-4000-8000-000000000091', 'f1000000-0000-4000-8000-000000000001', false),
  ('resolution_rules', 'f1000000-0000-4000-8000-000000000092', 'f1000000-0000-4000-8000-000000000002', false),
  ('user_overrides', 'f1000000-0000-4000-8000-000000000100', 'f1000000-0000-4000-8000-000000000001', false),
  ('user_overrides', 'f1000000-0000-4000-8000-000000000101', 'f1000000-0000-4000-8000-000000000002', false);

-- Grants below are ONLY for temporary test metadata/helpers, not app tables.
grant select on pg_temp.foundation_test_ids to authenticated, anon;

create function pg_temp.assert_foundation_visibility()
returns void language plpgsql security invoker as $$
declare
  relation_name text;
  all_ids uuid[];
  expected_ids uuid[];
  actual_ids uuid[];
begin
  if current_user not in ('authenticated', 'anon')
     or exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Visibility checks must run as an ordinary authenticated/anon role';
  end if;
  if current_user = 'authenticated' and auth.uid() is null then
    raise exception 'Authenticated fixture claims were not installed';
  end if;
  if current_user = 'anon' and auth.uid() is not null then
    raise exception 'Anonymous fixture still has an owner claim';
  end if;
  for relation_name in select distinct table_name from pg_temp.foundation_test_ids loop
    select array_agg(id order by id),
      coalesce(array_agg(id order by id) filter (where is_public or owner_user_id = auth.uid()), '{}'::uuid[])
      into all_ids, expected_ids
      from pg_temp.foundation_test_ids where table_name = relation_name;
    begin
      execute format('select coalesce(array_agg(id order by id), ''{}''::uuid[]) from public.%I where id = any($1)', relation_name)
        into actual_ids using all_ids;
    exception when insufficient_privilege then
      -- An outright anonymous denial is also safe for wholly private tables.
      if current_user = 'anon' and cardinality(expected_ids) = 0 then
        continue;
      end if;
      raise;
    end;
    if actual_ids is distinct from expected_ids then
      raise exception 'Unexpected % rows for %: expected %, got %', relation_name, current_user, expected_ids, actual_ids;
    end if;
  end loop;
end;
$$;

create function pg_temp.expect_rejected(statement text, expected_states text[])
returns void language plpgsql security invoker as $$
declare
  actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state = any(expected_states) then return; end if;
    raise;
  end;
  raise exception 'Statement unexpectedly succeeded; expected SQLSTATE %', expected_states;
end;
$$;

create function pg_temp.expect_no_write(statement text)
returns void language plpgsql security invoker as $$
declare
  affected bigint;
begin
  begin
    execute statement;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then return;
  end;
  if affected <> 0 then
    raise exception 'Forbidden write affected % rows', affected;
  end if;
end;
$$;

create function pg_temp.assert_system_writes_denied()
returns void language plpgsql security invoker as $$
declare
  fixture record;
  editable_field text;
  replacement jsonb;
begin
  if current_user not in ('authenticated', 'anon') then raise exception 'Expected ordinary application role'; end if;
  for fixture in
    select distinct on (table_name) table_name, id
    from pg_temp.foundation_test_ids
    where table_name <> 'user_overrides' and (is_public or owner_user_id = auth.uid())
    order by table_name, is_public, id
  loop
    editable_field := case fixture.table_name
      when 'courses' then 'title' when 'course_offerings' then 'offering_key'
      when 'course_sections' then 'label' when 'user_enrollments' then 'status'
      when 'assignments' then 'title' when 'personal_events' then 'title'
      when 'source_observations' then 'value' when 'resolution_rules' then 'reason'
    end;
    perform pg_temp.expect_no_write(format('update public.%I set %I = %I where id = %L',
      fixture.table_name, editable_field, editable_field, fixture.id));
    perform pg_temp.expect_no_write(format('delete from public.%I where id = %L',
      fixture.table_name, fixture.id));

    -- Clone a visible valid row with a distinct PK/unique key. INSERT must be
    -- denied by privileges/RLS, not accidentally fail a uniqueness constraint.
    replacement := jsonb_build_object('id', 'f1000000-0000-4000-8000-000000008000');
    if fixture.table_name = 'courses' then
      replacement := replacement || jsonb_build_object('family_key', 'FOUNDATION-DENIED-INSERT');
    elsif fixture.table_name = 'course_offerings' then
      replacement := replacement || jsonb_build_object('offering_key', 'denied-insert');
    elsif fixture.table_name = 'course_sections' then
      replacement := replacement || jsonb_build_object('section_key', 'denied-insert');
    end if;
    perform pg_temp.expect_rejected(format(
      'insert into public.%I select (jsonb_populate_record(null::public.%I, to_jsonb(src) || %L::jsonb)).* from public.%I src where id = %L',
      fixture.table_name, fixture.table_name, replacement::text, fixture.table_name, fixture.id),
      array['42501']);
  end loop;
end;
$$;

grant execute on function pg_temp.assert_foundation_visibility() to authenticated, anon;
grant execute on function pg_temp.expect_rejected(text, text[]) to authenticated, anon;
grant execute on function pg_temp.expect_no_write(text) to authenticated, anon;
grant execute on function pg_temp.assert_system_writes_denied() to authenticated, anon;

-- Seed only synthetic records using the administrator connection.
insert into public.courses (id, institution_id, family_key, title)
values ('f1000000-0000-4000-8000-000000000020', 'f1000000-0000-4000-8000-000000000010', 'FOUNDATION-TEST-209', 'Synthetic Strategy');
insert into public.course_offerings (id, course_id, term_id, offering_key)
values ('f1000000-0000-4000-8000-000000000030', 'f1000000-0000-4000-8000-000000000020', 'f1000000-0000-4000-8000-000000000011', 'foundation-test');
insert into public.course_sections (id, offering_id, section_key, label)
values ('f1000000-0000-4000-8000-000000000040', 'f1000000-0000-4000-8000-000000000030', 'foundation-test', 'Synthetic section');
insert into public.user_enrollments (id, owner_user_id, offering_id, section_ids, status, source)
values ('f1000000-0000-4000-8000-000000000050', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000030', array['f1000000-0000-4000-8000-000000000040'::uuid], 'enrolled', 'synthetic-test'),
       ('f1000000-0000-4000-8000-000000000051', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000030', array['f1000000-0000-4000-8000-000000000040'::uuid], 'enrolled', 'synthetic-test');
insert into public.assignments (id, owner_user_id, offering_id, title)
values ('f1000000-0000-4000-8000-000000000060', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000030', 'A_ONLY synthetic assignment'),
       ('f1000000-0000-4000-8000-000000000061', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000030', 'B_ONLY synthetic assignment');
insert into public.personal_events (id, owner_user_id, assignment_id, title, event_kind)
values ('f1000000-0000-4000-8000-000000000070', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000060', 'A_ONLY synthetic deadline', 'deadline'),
       ('f1000000-0000-4000-8000-000000000071', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000061', 'B_ONLY synthetic deadline', 'deadline');
insert into public.source_observations (id, owner_user_id, entity_id, field, value, basis, source, source_authority, fetched_at, revision)
values ('f1000000-0000-4000-8000-000000000080', null, 'f1000000-0000-4000-8000-000000000020', 'due_at', '2026-11-04T17:30:00-08:00', 'verified_base', 'synthetic-public', 10, now(), 1),
       ('f1000000-0000-4000-8000-000000000081', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000060', 'due_at', '2026-11-04T17:30:00-08:00', 'verified_base', 'synthetic-private', 100, now(), 1),
       ('f1000000-0000-4000-8000-000000000082', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000061', 'due_at', '2026-11-04T17:30:00-08:00', 'verified_base', 'synthetic-private', 100, now(), 1);
insert into public.resolution_rules (id, version, owner_user_id, field, section_id, assignment_id, operation, days, accepted_basis, expected_value, expected_revision, exception_of, reason)
values ('f1000000-0000-4000-8000-000000000090', 1, null, 'due_at', 'f1000000-0000-4000-8000-000000000040', null, 'shift_days', 1, array['verified_base'], '2026-11-04T17:30:00-08:00', null, null, 'Synthetic public rule'),
       ('f1000000-0000-4000-8000-000000000091', 1, 'f1000000-0000-4000-8000-000000000001', 'due_at', null, 'f1000000-0000-4000-8000-000000000060', 'suppress_shift', null, array['verified_base'], null, 1, 'f1000000-0000-4000-8000-000000000090', 'A_ONLY private rule'),
       ('f1000000-0000-4000-8000-000000000092', 1, 'f1000000-0000-4000-8000-000000000002', 'due_at', null, 'f1000000-0000-4000-8000-000000000061', 'suppress_shift', null, array['verified_base'], null, 1, 'f1000000-0000-4000-8000-000000000090', 'B_ONLY private rule');
insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason)
values ('f1000000-0000-4000-8000-000000000100', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000070', 'due_at', '2026-11-03T17:30:00-08:00', 'A_ONLY personal plan'),
       ('f1000000-0000-4000-8000-000000000101', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000071', 'due_at', '2026-11-03T17:30:00-08:00', 'B_ONLY personal plan');

-- Privileged inserts verify constraints independently of RLS denials.
do $$
declare
  guard record;
  operation_name text;
begin
  foreach operation_name in array array['shift_days', 'suppress_shift'] loop
    for guard in select * from (values
      (null::text, null::integer), ('', null), (E' \t\n', null),
      (null, 0), (null, -1), ('reviewed-value', 0), (' ', 1)
    ) as invalid(expected_value, expected_revision) loop
      perform pg_temp.expect_rejected(format(
        'insert into public.resolution_rules (id, version, field, operation, accepted_basis, expected_value, expected_revision, reason) values (%L, 1, ''due_at'', %L, array[''verified_base''], %L, %L, ''invalid synthetic guard'')',
        'f1000000-0000-4000-8000-000000009000', operation_name, guard.expected_value, guard.expected_revision), array['23514']);
    end loop;
  end loop;
  -- A meaningful value-only guard and a positive revision-only guard are valid.
  insert into public.resolution_rules (id, version, field, operation, accepted_basis, expected_value, reason)
  values ('f1000000-0000-4000-8000-000000009001', 1, 'due_at', 'shift_days', array['verified_base'], '2026-11-04T17:30:00-08:00', 'Synthetic value-only guard');
  insert into public.resolution_rules (id, version, field, operation, accepted_basis, expected_revision, reason)
  values ('f1000000-0000-4000-8000-000000009002', 1, 'due_at', 'suppress_shift', array['verified_base'], 1, 'Synthetic revision-only guard');
  delete from public.resolution_rules where id in ('f1000000-0000-4000-8000-000000009001', 'f1000000-0000-4000-8000-000000009002');

  perform pg_temp.expect_rejected(
    'insert into public.personal_events (id, owner_user_id, assignment_id, title, event_kind) values (''f1000000-0000-4000-8000-000000009003'', ''f1000000-0000-4000-8000-000000000001'', ''f1000000-0000-4000-8000-000000000061'', ''cross-owner synthetic event'', ''deadline'')',
    array['23503']);
  perform pg_temp.expect_rejected(
    'insert into public.resolution_rules (id, version, field, assignment_id, operation, accepted_basis, expected_revision, reason) values (''f1000000-0000-4000-8000-000000009004'', 1, ''due_at'', ''f1000000-0000-4000-8000-000000000060'', ''suppress_shift'', array[''verified_base''], 1, ''private assignment without owner'')',
    array['23514']);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.assert_foundation_visibility();
select pg_temp.assert_system_writes_denied();

do $$
declare
  affected bigint;
begin
  if auth.uid() <> 'f1000000-0000-4000-8000-000000000001'::uuid then raise exception 'Wrong authenticated owner context'; end if;

  -- The owner can edit, delete, and recreate its own override.
  update public.user_overrides set value = '2026-11-02T17:30:00-08:00', reason = 'Synthetic edited plan'
    where id = 'f1000000-0000-4000-8000-000000000100';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override update did not affect exactly one row'; end if;
  delete from public.user_overrides where id = 'f1000000-0000-4000-8000-000000000100';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override delete did not affect exactly one row'; end if;
  insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason)
    values ('f1000000-0000-4000-8000-000000000100', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000070', 'due_at', '2026-11-03T17:30:00-08:00', 'Synthetic recreated plan');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override insert did not affect exactly one row'; end if;

  perform pg_temp.expect_no_write(
    'update public.user_overrides set reason = ''foreign edit'' where id = ''f1000000-0000-4000-8000-000000000101''');
  perform pg_temp.expect_no_write(
    'delete from public.user_overrides where id = ''f1000000-0000-4000-8000-000000000101''');
  perform pg_temp.expect_rejected(
    'insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason) values (''f1000000-0000-4000-8000-000000009010'', ''f1000000-0000-4000-8000-000000000001'', ''f1000000-0000-4000-8000-000000000071'', ''due_at'', ''synthetic'', ''cross-owner FK'')',
    array['23503']);
  perform pg_temp.expect_rejected(
    'update public.user_overrides set event_id = ''f1000000-0000-4000-8000-000000000071'' where id = ''f1000000-0000-4000-8000-000000000100''',
    array['23503']);
  perform pg_temp.expect_rejected(
    'insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason) values (''f1000000-0000-4000-8000-000000009011'', ''f1000000-0000-4000-8000-000000000002'', ''f1000000-0000-4000-8000-000000000071'', ''synthetic_new_field'', ''synthetic'', ''foreign owner'')',
    array['42501']);
  perform pg_temp.expect_rejected(
    'update public.user_overrides set owner_user_id = ''f1000000-0000-4000-8000-000000000002'' where id = ''f1000000-0000-4000-8000-000000000100''',
    array['42501']);
end;
$$;
select pg_temp.assert_foundation_visibility();
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.assert_foundation_visibility();
select pg_temp.assert_system_writes_denied();

do $$
declare
  affected bigint;
begin
  if auth.uid() <> 'f1000000-0000-4000-8000-000000000002'::uuid then raise exception 'Wrong authenticated owner context'; end if;

  -- The owner can edit, delete, and recreate its own override.
  update public.user_overrides set value = '2026-11-02T17:30:00-08:00', reason = 'Synthetic edited plan'
    where id = 'f1000000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override update did not affect exactly one row'; end if;
  delete from public.user_overrides where id = 'f1000000-0000-4000-8000-000000000101';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override delete did not affect exactly one row'; end if;
  insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason)
    values ('f1000000-0000-4000-8000-000000000101', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000071', 'due_at', '2026-11-03T17:30:00-08:00', 'Synthetic recreated plan');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own override insert did not affect exactly one row'; end if;

  perform pg_temp.expect_no_write(
    'update public.user_overrides set reason = ''foreign edit'' where id = ''f1000000-0000-4000-8000-000000000100''');
  perform pg_temp.expect_no_write(
    'delete from public.user_overrides where id = ''f1000000-0000-4000-8000-000000000100''');
  perform pg_temp.expect_rejected(
    'insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason) values (''f1000000-0000-4000-8000-000000009010'', ''f1000000-0000-4000-8000-000000000002'', ''f1000000-0000-4000-8000-000000000070'', ''due_at'', ''synthetic'', ''cross-owner FK'')',
    array['23503']);
  perform pg_temp.expect_rejected(
    'update public.user_overrides set event_id = ''f1000000-0000-4000-8000-000000000070'' where id = ''f1000000-0000-4000-8000-000000000101''',
    array['23503']);
  perform pg_temp.expect_rejected(
    'insert into public.user_overrides (id, owner_user_id, event_id, field, value, reason) values (''f1000000-0000-4000-8000-000000009011'', ''f1000000-0000-4000-8000-000000000001'', ''f1000000-0000-4000-8000-000000000070'', ''synthetic_new_field'', ''synthetic'', ''foreign owner'')',
    array['42501']);
  perform pg_temp.expect_rejected(
    'update public.user_overrides set owner_user_id = ''f1000000-0000-4000-8000-000000000001'' where id = ''f1000000-0000-4000-8000-000000000101''',
    array['42501']);
end;
$$;
select pg_temp.assert_foundation_visibility();
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_foundation_visibility();
select pg_temp.assert_system_writes_denied();
reset role;

rollback;
select 'phase1 foundation database checks: pass (rolled back)' as result;
