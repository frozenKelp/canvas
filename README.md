# Canvas

A minimal public web canvas for `https://frozenkelp.vip/canvas`.

Click anywhere to create a textbox. Type anything, including links. Press Enter to save the box; the first URL becomes an image, GIF, video, YouTube/Vimeo embed, or website preview card when possible. Hold `M` to pan the canvas, move owned boxes from anywhere inside them, and wheel-zoom around the cursor. Use the bottom-right dot on a selected box to resize, hold `G` while dragging it to keep the aspect ratio, or hold `R` while dragging it to rotate. Your browser cookie owns your boxes, so the same browser can edit and delete them.

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
VITE_LINK_PREVIEW_ENDPOINT=https://your-preview-worker.example/preview
```

Run the database SQL in `supabase/schema.sql`. `VITE_LINK_PREVIEW_ENDPOINT` is optional; without it, generic websites show a static fallback card. More notes live in `docs/supabase-setup.md`.

## Deploy

This repo is configured as a GitHub Pages project page with Vite base `/canvas/`.

In GitHub:

1. Settings > Pages > Source: GitHub Actions.
2. Settings > Secrets and variables > Actions > Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_LINK_PREVIEW_ENDPOINT`
3. Push to `main`.

No `CNAME` file is included here because the target URL is a project path under the existing `frozenkelp.vip` Pages site.

## Checks

```powershell
pnpm test
pnpm lint
pnpm build
```
