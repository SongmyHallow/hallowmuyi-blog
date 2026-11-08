import { getCollection } from 'astro:content';

// 构建时生成站内搜索索引
export async function GET() {
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const index = posts.map((p) => ({
    slug: p.id,
    title: p.data.title,
    date: p.data.date.toISOString().slice(0, 10),
    description: p.data.description ?? '',
    tags: p.data.tags,
    body: (p.body ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`\-\[\]()!|]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500),
  }));
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
