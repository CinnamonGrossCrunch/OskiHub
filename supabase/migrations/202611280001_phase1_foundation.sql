create table if not exists public.courses (
  id uuid primary key,
  institution_id uuid not null,
  family_key text not null,
  title text not null,
  unique (institution_id, family_key)
);
create table if not exists public.course_offerings (
  id uuid primary key,
  course_id uuid not null references public.courses(id),
  term_id uuid not null,
  offering_key text not null,
  unique (course_id, term_id, offering_key)
);
create table if not exists public.course_sections (
  id uuid primary key,
  offering_id uuid not null references public.course_offerings(id),
  section_key text not null,
  label text,
  unique (offering_id, section_key)
);
create table if not exists public.user_enrollments (
  id uuid primary key,
  owner_user_id uuid not null,
  offering_id uuid not null references public.course_offerings(id),
  section_ids uuid[] not null default '{}',
  status text not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);
create table if not exists public.assignments (
  id uuid primary key,
  owner_user_id uuid not null,
  offering_id uuid not null references public.course_offerings(id),
  title text not null,
  unique (id, owner_user_id)
);
create table if not exists public.personal_events (
  id uuid primary key,
  owner_user_id uuid not null,
  assignment_id uuid,
  section_id uuid references public.course_sections(id),
  title text not null,
  event_kind text not null,
  unique (id, owner_user_id),
  foreign key (assignment_id, owner_user_id) references public.assignments(id, owner_user_id)
);
create table if not exists public.source_observations (
  id uuid primary key,
  owner_user_id uuid,
  entity_id uuid not null,
  field text not null,
  value text not null,
  basis text,
  source text not null,
  source_authority integer not null default 0,
  fetched_at timestamptz not null,
  revision integer not null default 1
);
create table if not exists public.resolution_rules (
  id uuid primary key,
  version integer not null,
  owner_user_id uuid,
  field text not null,
  section_id uuid references public.course_sections(id),
  assignment_id uuid,
  operation text not null,
  days integer,
  accepted_basis text[] not null,
  expected_value text,
  expected_revision integer,
  exception_of uuid references public.resolution_rules(id),
  reason text not null,
  check (assignment_id is null or owner_user_id is not null)
);
create table if not exists public.user_overrides (
  id uuid primary key,
  owner_user_id uuid not null,
  event_id uuid not null,
  field text not null,
  value text not null,
  reason text not null,
  unique (owner_user_id, event_id, field),
  foreign key (event_id, owner_user_id) references public.personal_events(id, owner_user_id)
);

alter table public.courses enable row level security;
alter table public.course_offerings enable row level security;
alter table public.course_sections enable row level security;
alter table public.user_enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.personal_events enable row level security;
alter table public.source_observations enable row level security;
alter table public.resolution_rules enable row level security;
alter table public.user_overrides enable row level security;

create policy "public reads courses" on public.courses for select using (true);
create policy "public reads offerings" on public.course_offerings for select using (true);
create policy "public reads sections" on public.course_sections for select using (true);
create policy "scoped reads rules" on public.resolution_rules for select using ((owner_user_id is null and assignment_id is null) or owner_user_id = auth.uid());
create policy "owner reads enrollments" on public.user_enrollments for select using (owner_user_id = auth.uid());
create policy "owner reads assignments" on public.assignments for select using (owner_user_id = auth.uid());
create policy "owner reads events" on public.personal_events for select using (owner_user_id = auth.uid());
create policy "owner reads observations" on public.source_observations for select using (owner_user_id is null or owner_user_id = auth.uid());
create policy "owner reads overrides" on public.user_overrides for select using (owner_user_id = auth.uid());
create policy "owner writes overrides" on public.user_overrides for insert with check (owner_user_id = auth.uid());
create policy "owner updates overrides" on public.user_overrides for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "owner deletes overrides" on public.user_overrides for delete using (owner_user_id = auth.uid());
-- No authenticated insert/update/delete policies for enrollments, assignments,
-- events, observations, catalog, or rules: those writes are server-managed.
