# Supabase Setup

This app is a static GitHub Pages frontend backed by Supabase Postgres and Realtime.

## Create The Project

1. Create a new Supabase project in the dashboard.
2. Open SQL Editor.
3. Run the full contents of `supabase/schema.sql`.
4. In Database > Publications, confirm `canvas_items` is listed under `supabase_realtime`.

The schema includes explicit `GRANT` statements plus RLS policies. That matters for new Supabase projects because public tables are no longer safely assumed to be exposed to the Data API automatically.

## Configure Local Env

Create `.env`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Use the publishable key only. Do not put a secret or service role key in `.env`, GitHub variables, or browser code.

If these env vars are absent, the app runs against an in-memory local board so the UI can still be developed. Nothing persists until Supabase is configured.

## Anonymous Ownership

The app stores two browser cookies:

- `canvas_client_id`: machine/browser owner id
- `canvas_name`: visible author label

Writes send `x-canvas-client-id` to Supabase. RLS uses that header to allow a browser to edit/delete rows it created. This is intentionally lightweight ownership, not real authentication; a determined user can spoof a header.

## GitHub Pages Variables

For deployment, add repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Repository Settings > Secrets and variables > Actions > Variables.
