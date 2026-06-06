create extension if not exists "pgcrypto";

create table if not exists public.canvas_items (
  id uuid primary key default gen_random_uuid(),
  owner_client_id text not null
    constraint canvas_items_owner_client_id_shape
    check (
      char_length(owner_client_id) between 8 and 128
      and owner_client_id ~ '^[A-Za-z0-9_-]+$'
    ),
  owner_name text not null default 'anon'
    constraint canvas_items_owner_name_length
    check (char_length(owner_name) between 1 and 32 and btrim(owner_name) <> ''),
  content_text text not null default ''
    constraint canvas_items_content_text_length
    check (char_length(content_text) <= 20000),
  primary_url text null
    constraint canvas_items_primary_url_shape
    check (
      primary_url is null
      or (
        char_length(primary_url) <= 2048
        and primary_url ~* '^https?://'
        and primary_url !~ '[[:space:]<>"]'
      )
    ),
  embed_kind text not null default 'text'
    constraint canvas_items_embed_kind_valid
    check (
      embed_kind in ('text', 'image', 'video', 'youtube', 'vimeo', 'website')
    ),
  constraint canvas_items_embed_url_pair
    check (
      (embed_kind = 'text' and primary_url is null)
      or (embed_kind <> 'text' and primary_url is not null)
    ),
  x double precision not null default 0
    constraint canvas_items_x_reasonable check (abs(x) <= 100000000),
  y double precision not null default 0
    constraint canvas_items_y_reasonable check (abs(y) <= 100000000),
  width double precision not null default 280
    constraint canvas_items_width_bounds check (width between 140 and 10000),
  height double precision not null default 120
    constraint canvas_items_height_bounds check (height between 88 and 10000),
  rotation double precision not null default 0
    constraint canvas_items_rotation_bounds check (rotation >= 0 and rotation < 360),
  z_index integer not null default 0
    constraint canvas_items_z_index_nonnegative check (z_index >= 0),
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

create index if not exists canvas_items_order_idx
on public.canvas_items (z_index, created_at, id);

create index if not exists canvas_items_owner_idx
on public.canvas_items (owner_client_id, updated_at desc);

revoke all on table public.canvas_items from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
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
end;
$$;
