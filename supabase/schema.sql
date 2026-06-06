create extension if not exists "pgcrypto";

create table if not exists public.canvas_items (
  id uuid primary key default gen_random_uuid(),
  owner_client_id text not null check (char_length(owner_client_id) between 8 and 128),
  owner_name text not null default 'anon' check (char_length(owner_name) between 1 and 32),
  content_text text not null default '' check (char_length(content_text) <= 20000),
  primary_url text null check (primary_url is null or primary_url ~ '^https?://'),
  embed_kind text not null default 'text' check (
    embed_kind in ('text', 'image', 'video', 'youtube', 'vimeo', 'website')
  ),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 280 check (width >= 80),
  height double precision not null default 120 check (height >= 60),
  rotation double precision not null default 0,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_canvas_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_canvas_items_updated_at() from public, anon, authenticated;

drop trigger if exists canvas_items_touch_updated_at on public.canvas_items;
create trigger canvas_items_touch_updated_at
before update on public.canvas_items
for each row
execute function public.touch_canvas_items_updated_at();

grant select, insert, update, delete on table public.canvas_items to anon, authenticated;

alter table public.canvas_items enable row level security;

drop policy if exists "Anyone can read canvas items" on public.canvas_items;
create policy "Anyone can read canvas items"
on public.canvas_items
for select
to anon, authenticated
using (true);

drop policy if exists "Browsers can create their own canvas items" on public.canvas_items;
create policy "Browsers can create their own canvas items"
on public.canvas_items
for insert
to anon, authenticated
with check (
  owner_client_id = (
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-canvas-client-id'
  )
);

drop policy if exists "Browsers can update their own canvas items" on public.canvas_items;
create policy "Browsers can update their own canvas items"
on public.canvas_items
for update
to anon, authenticated
using (
  owner_client_id = (
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-canvas-client-id'
  )
)
with check (
  owner_client_id = (
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-canvas-client-id'
  )
);

drop policy if exists "Browsers can delete their own canvas items" on public.canvas_items;
create policy "Browsers can delete their own canvas items"
on public.canvas_items
for delete
to anon, authenticated
using (
  owner_client_id = (
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-canvas-client-id'
  )
);

alter table public.canvas_items replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'canvas_items'
  ) then
    alter publication supabase_realtime add table public.canvas_items;
  end if;
end
$$;
