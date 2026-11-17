import type { APIRoute } from 'astro';
import { isDryRun, isFull, readJson, searchQuery } from '../../lib/api';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getPostRecord, listPostRecords, savePost } from '../../lib/db';
import { normalizePost, ValidationError } from '../../lib/validate';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const records = await listPostRecords({
      includeDrafts: true,
      q: searchQuery(request),
    });
    if (isFull(request)) {
      return json({
        posts: records.map(({ post, version }) => ({ ...post, version })),
      });
    }
    return json({
      posts: records.map(({ post, version }) => ({
        name: post.slug,
        slug: post.slug,
        title: post.title,
        version,
      })),
    });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const body = await readJson(request);
    const normalized = normalizePost(String(body.slug ?? ''), body.post);
    if (await getPostRecord(normalized.slug)) {
      return json({ error: 'slug 已存在，请换一个' }, { status: 400 });
    }
    if (isDryRun(request)) {
      return json({ ok: true, dryRun: true, slug: normalized.slug, version: null });
    }
    const version = await savePost(normalized);
    return json({ ok: true, slug: normalized.slug, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};
