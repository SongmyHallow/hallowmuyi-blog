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

## Documentation

Full Astro documentation: https://docs.astro.build

- [Routing / endpoints](https://docs.astro.build/en/guides/routing/)
- [On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Astro + Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Styling / Tailwind](https://docs.astro.build/en/guides/styling/)
