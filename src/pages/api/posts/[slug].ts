import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../../lib/auth';
import { deletePost, getPost, savePost } from '../../../lib/db';
import { normalizePost, ValidationError } from '../../../lib/validate';

export const GET: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const post = await getPost(slug);
    if (!post) return json({ error: '文章不存在' }, { status: 404 });
    return json({ post });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const { post } = (await request.json()) as { post?: unknown };
    await savePost(normalizePost(slug, post));
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    await deletePost(params.slug ?? '');
    return json({ ok: true });
  } catch (error) {
    return json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
};
