# Canvas

A minimal public web canvas for `https://frozenkelp.vip/canvas`.

Click anywhere to create a textbox. Type anything, including links. Press Enter to save the box; the first URL becomes an image, GIF, video, YouTube/Vimeo embed, or website frame when possible. Your browser cookie owns your boxes, so the same browser can move, resize, rotate, edit, and delete them.

## Local Development

This project uses `pnpm@11.5.2`.

```powershell
pnpm install
pnpm dev
```

Without Supabase env vars, the app runs against a local in-memory board. Nothing persists until Supabase is configured.

Create `.env` from `.env.example`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Run the database SQL in `supabase/schema.sql`. More notes live in `docs/supabase-setup.md`.

## Deploy

This repo is configured as a GitHub Pages project page with Vite base `/canvas/`.

In GitHub:

1. Settings > Pages > Source: GitHub Actions.
2. Settings > Secrets and variables > Actions > Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Push to `main`.

No `CNAME` file is included here because the target URL is a project path under the existing `frozenkelp.vip` Pages site.

## Checks

```powershell
pnpm test
pnpm lint
pnpm build
```
