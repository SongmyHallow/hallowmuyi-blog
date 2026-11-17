import type { APIContext } from 'astro';
import { listGames, listPosts } from '../lib/db';

const STATIC_PATHS = ['/', '/blog', '/archive', '/tags', '/about', '/games', '/rss.xml'];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Entry {
  path: string;
  lastmod?: string;
}

export async function GET(context: APIContext) {
  const site = context.site!;
  const [posts, games] = await Promise.all([listPosts(), listGames()]);

  const tags = new Set(posts.flatMap((post) => post.tags));
  const entries: Entry[] = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...posts.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date })),
    ...games.map((game) => ({ path: `/games/${game.slug}` })),
    ...[...tags].map((tag) => ({ path: `/tags/${tag}` })),
  ];

  const urls = entries.map(({ path, lastmod }) => {
    const loc = escapeXml(new URL(path, site).href);
    const date = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
    return `<url><loc>${loc}</loc>${date}</url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  });
}
