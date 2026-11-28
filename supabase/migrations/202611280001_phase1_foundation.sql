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
  updated_at timestamptz not null default now()
);
create table if not exists public.assignments (
  id uuid primary key,
  owner_user_id uuid not null,
  offering_id uuid not null references public.course_offerings(id),
  title text not null
);
create table if not exists public.personal_events (
  id uuid primary key,
  owner_user_id uuid not null,
  assignment_id uuid references public.assignments(id),
  section_id uuid references public.course_sections(id),
  title text not null,
  event_kind text not null
);
create table if not exists public.source_observations (
  id uuid primary key,
  owner_user_id uuid,
  entity_id uuid not null,
  field text not null,
  value text not null,
  basis text,
  source text not null,
  fetched_at timestamptz not null,
  revision integer not null default 1
);
create table if not exists public.resolution_rules (
  id uuid primary key,
  version integer not null,
  field text not null,
  section_id uuid references public.course_sections(id),
  assignment_id uuid references public.assignments(id),
  operation text not null,
  days integer,
  accepted_basis text[] not null,
  exception_of uuid references public.resolution_rules(id),
  reason text not null
);
create table if not exists public.user_overrides (
  id uuid primary key,
  owner_user_id uuid not null,
  event_id uuid not null references public.personal_events(id),
  field text not null,
  value text not null,
  reason text not null,
  unique (owner_user_id, event_id, field)
);

alter table public.user_enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.personal_events enable row level security;
alter table public.source_observations enable row level security;
alter table public.user_overrides enable row level security;

create policy "owner reads enrollments" on public.user_enrollments for select using (owner_user_id = auth.uid());
create policy "owner reads assignments" on public.assignments for select using (owner_user_id = auth.uid());
create policy "owner reads events" on public.personal_events for select using (owner_user_id = auth.uid());
create policy "owner reads observations" on public.source_observations for select using (owner_user_id is null or owner_user_id = auth.uid());
create policy "owner reads overrides" on public.user_overrides for select using (owner_user_id = auth.uid());
