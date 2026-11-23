## Project

Astro 7 SSR blog deployed on **Cloudflare Workers + D1** (not Cloudflare Pages). Read
`README.md` first for architecture, data model and deployment.

- Data lives in Cloudflare D1; all pages read it at request time. Editing content in
  `/admin` takes effect immediately — there is no build/deploy step for content.
- `src/lib/db.ts` is the only data-access layer. Add SQL there, not inside pages.
- `src/content/` is legacy seed data only; `scripts/build-seed.mjs` converts it into
  `db/seed.sql`. Do not expect edits there to show up on the site.
- Input validation for posts/games lives in `src/lib/validate.ts`; keep its error
  messages, the admin UI surfaces them verbatim.
- Content automation goes through `scripts/content.mjs` (`npm run content -- ...`), which
  talks to the admin API with `Authorization: Bearer $BLOG_API_TOKEN` (server side:
  `API_TOKEN` secret). Prefer it over raw SQL or hand-written curl.
- Writes use optimistic locking: `GET` returns `version`, and `PUT`/`PATCH`/`DELETE` send it
  back as `If-Match` (mismatch → 409 with the current version). `PATCH` merges only the
  supplied fields; `?dryRun=1` validates without writing. The machine-readable contract is
  `GET /api/schema`.
- Never run `git add -A`: this workspace is shared with other tooling and unrelated files
  (`.lark-device.json`, QR images, one-off SQL) have been committed by accident before.
  Stage explicit paths only.
- Comments are self-hosted (no Giscus): `comments` table, public `POST /api/comments`
  (honeypot field `website`, 3 per IP per 10 minutes), moderation via `PATCH
  /api/comments/<id>` with `{status: 'pending'|'approved'|'hidden'}`, admin UI at
  `/admin` → 「评论审核」. New comments default to `pending` and are invisible on the
  public page until approved. Keep the honeypot and rate limit in `src/pages/api/comments.ts`.

## Development

```bash
npm run db:local:init   # create local tables
npm run db:local:seed   # import seed content (optional)
npm run dev -- --background
```

The admin password for local dev comes from `.dev.vars` (`ADMIN_PASSWORD=...`), which is
gitignored.

Manage the background dev server with `astro dev stop`, `astro dev status`, and
`astro dev logs`.

Preview the real Worker bundle with `npm run preview` (it passes
`--persist-to .wrangler/state`; without it Wrangler opens an empty database).

Deploy with `npm run deploy` (= `astro build && node scripts/deploy.mjs`). Never run bare
`wrangler deploy`: the Cloudflare adapter regenerates `dist/server/wrangler.json` and drops
`routes` from the root config, so custom domains must be injected by `scripts/deploy.mjs`
(edit its `ROUTES` to change domains).

## Cloudflare notes

- Bindings are read with `import { env } from 'cloudflare:workers'`
  (`Astro.locals.runtime` is gone in adapter v14+).
- `wrangler.jsonc` holds the `DB` D1 binding; the checked-in `database_id` is the live
  `hallowmuyi` database.
- Image processing is disabled (`imageService: 'passthrough'`) so no Images binding is
  required. Remote cover URLs are rendered directly.
- HTML caching lives in `src/middleware.ts`: GET + `Accept: text/html` responses are stored
  in the Workers Cache API for 60s and served with `x-cache: HIT`. Requests carrying the
  `hm_admin` cookie bypass the cache (`private, no-store`) so authors always see fresh
  content. Keep the client-facing `Cache-Control` `private` — Cloudflare's zone-level
  Browser Cache TTL rewrites a public `max-age` to 4 hours, which makes visitors see stale
  pages. `/api/`, `/admin`, `/_astro/`, `/fonts/` are never cached here.
- Link prefetching is enabled globally in `astro.config.mjs`
  (`prefetch: { prefetchAll: true, defaultStrategy: 'hover' }`), so nav between pages is
  instant once the target HTML is in the browser cache.
- Pixel font is shipped as two woff2 subsets in `public/fonts/` (`-core` for ASCII +
  punctuation + GB2312 level 1, `-ext` for rare glyphs) selected by `unicode-range` in
  `src/styles/global.css`. Regenerate with
  `python scripts/build_fonts.py scripts/fonts/fusion-pixel-12px-src.woff2 public/fonts`
  (needs `fonttools` + `brotli`); paste `scripts/fonts/font-face.css` back into
  `global.css` if the ranges change. Never hand-edit the ranges.
- Home page (`src/pages/index.astro`) renders the full post list (one full-width row per
  post) server-side and filters it client-side by tag checkboxes (`?tags=a,b` is the source
  of truth on load). The avatar is `public/avatar.png` (pixel panda) rendered as a 56px
  square with a cream backing; replace that file to change it. "近期游戏" comes from
  `listGames()` sorted by last-updated, so editing a game in admin is what pushes it into
  that block.
- `scripts/deploy.mjs` appends `/fonts/* → Cache-Control: immutable` to
  `dist/client/_headers` before deploying, so fonts are cached for a year.

## Documentation

Full Astro documentation: https://docs.astro.build

- [Routing / endpoints](https://docs.astro.build/en/guides/routing/)
- [On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Astro + Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Styling / Tailwind](https://docs.astro.build/en/guides/styling/)
