import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getPage, savePage } from '../../lib/db';

const ABOUT_SLUG = 'about';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const page = await getPage(ABOUT_SLUG);
    return json({ body: page?.body ?? '', title: page?.title ?? '关于' });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const { body } = (await request.json()) as { body?: unknown };
    if (typeof body !== 'string') {
      return json({ error: '正文格式错误' }, { status: 400 });
    }
    await savePage({ slug: ABOUT_SLUG, title: '关于', body: body.trim() });
    return json({ ok: true });
  } catch (error) {
    return json({ error: (error as Error).message || '保存失败' }, { status: 500 });
  }
};
