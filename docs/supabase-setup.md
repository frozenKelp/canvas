# Supabase Setup

This app is a static GitHub Pages frontend backed by Supabase Postgres and Realtime.

## Create The Project

1. Create a new Supabase project in the dashboard.
2. Open SQL Editor.
3. Run the full contents of `supabase/schema.sql`.
4. In Database > Publications, confirm `canvas_items` is listed under `supabase_realtime`.
5. In Table Editor > `canvas_items`, confirm Row Level Security is enabled.

The schema includes explicit `GRANT` statements plus RLS policies. Supabase's Data API uses grants to decide whether `anon` can reach a table at all, then RLS decides which rows that role can read or write. The SQL also adds the table to the `supabase_realtime` publication so browser clients can subscribe to live changes.

The table is intentionally public-readable. Everyone can see every canvas item; only the browser that created a row can update or delete it.

## Configure Local Env

Create `.env`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_LINK_PREVIEW_ENDPOINT=https://your-cloudflare-worker/preview
```

Use the publishable key only. Do not put a secret or service role key in `.env`, GitHub variables, GitHub Pages builds, or browser code.

If these env vars are absent, the app runs against an in-memory local board so the UI can still be developed. Nothing persists until Supabase is configured.

`VITE_LINK_PREVIEW_ENDPOINT` is optional and points to the Cloudflare Worker preview service. It is not a Supabase setting.

## Anonymous Ownership

The app stores two browser cookies:

- `canvas_client_id`: machine/browser owner id
- `canvas_name`: visible author label

Writes send `x-canvas-client-id` to Supabase. RLS uses that header to allow a browser to edit/delete rows it created. This is intentionally lightweight ownership, not real authentication; a determined user can spoof a header.

Realtime subscriptions use the table's public `SELECT` policy, so they do not depend on that custom header. The header only matters for inserts, updates, and deletes through the Data API.

## Schema Notes

- `canvas_items_order_idx` supports the app's `z_index, created_at` load order.
- `canvas_items_owner_idx` helps owner-focused maintenance and future cleanup jobs.
- Width, height, rotation, position, URL length, and text length have database checks because this is a public write surface.
- `replica identity full` lets Realtime send enough old-row data for delete handling.

## GitHub Pages Variables

For deployment, add repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_LINK_PREVIEW_ENDPOINT`

Repository Settings > Secrets and variables > Actions > Variables.
