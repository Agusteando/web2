# IECS-IEDIS (Nuxt 3) - legacy HTML preserved + dynamic noticias

This project serves your designer's original HTML **as-is** (pixel-perfect), but injects the **Noticias** cards dynamically from MySQL.

## What you get
- `/` and `/index.html` are served from `public/legacy/index.html` with **server-side injection** of the latest 3 news items.
- `/api/noticias?limit=3` and `/api/noticias/:id` JSON endpoints.
- All other `.html` pages can remain static under `public/` (e.g. `public/daycare.html`) and will be served unchanged.

## Setup
1. Put your existing `assets/` folder (css/js/img/...) into: `public/assets/` **unchanged**
2. Create `.env` (see `.env.example`)
3. Install + run:
   ```bash
   npm install
   npm run dev
   ```

## Designer workflow
Designer keeps editing **only**:
- `public/legacy/index.html` (this file is your exact original index)
- any other static pages under `public/*.html`

No Vue template patching required.

## One-command refresh from a deployed site
If your designer publishes updates to a URL, you can refresh the template without copy/paste:
```bash
NUXT_PUBLIC_SITE_URL=https://casitaiedis.edu.mx npm run sync:legacy
```

