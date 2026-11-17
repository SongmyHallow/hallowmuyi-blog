import type { APIContext } from 'astro';
import { listPosts } from '../lib/db';

// 请求时生成站内搜索索引（数据来自 D1，文章更新后无需重新构建）
export async function GET(_context: APIContext) {
  const posts = await listPosts();
  const index = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    description: post.description,
    tags: post.tags,
    body: post.body
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`\-\[\]()!|]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500),
  }));
  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  });
}
