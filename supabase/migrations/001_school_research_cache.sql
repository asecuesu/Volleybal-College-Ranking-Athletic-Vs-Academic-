create table if not exists public.school_research_cache (
  school_key text not null,
  school_name text not null,
  research_type text not null check (research_type in ('setter','aid')),
  payload jsonb not null,
  source_url text,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (school_key, research_type)
);

alter table public.school_research_cache enable row level security;

drop policy if exists "public can read research cache" on public.school_research_cache;
create policy "public can read research cache"
on public.school_research_cache
for select
to anon, authenticated
using (true);

create index if not exists school_research_cache_expires_idx
  on public.school_research_cache (expires_at);
