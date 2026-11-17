import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listPosts } from '../lib/db';
import { renderMarkdown } from '../lib/markdown';
import { parseDate } from '../utils/postMeta';

export async function GET(context: APIContext) {
  const posts = await listPosts();
  return rss({
    title: 'MUYI BLOG',
    description: '记录与思考的角落',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: parseDate(post.date),
      link: `/blog/${post.slug}/`,
      categories: post.tags,
      content: renderMarkdown(post.body),
    })),
  });
}
