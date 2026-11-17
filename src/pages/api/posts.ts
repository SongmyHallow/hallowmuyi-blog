import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getPost, listPosts, savePost } from '../../lib/db';
import { normalizePost, ValidationError } from '../../lib/validate';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const posts = await listPosts({ includeDrafts: true });
    return json({
      posts: posts.map((post) => ({ name: post.slug, slug: post.slug, title: post.title })),
    });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const { slug, post } = (await request.json()) as { slug?: unknown; post?: unknown };
    const normalized = normalizePost(String(slug ?? ''), post);
    if (await getPost(normalized.slug)) {
      return json({ error: 'slug 已存在，请换一个' }, { status: 400 });
    }
    await savePost(normalized);
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};
