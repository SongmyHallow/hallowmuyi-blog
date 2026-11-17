import type { APIRoute } from 'astro';
import { conflict, isDryRun, preconditionFailed, readIfMatch, readJson } from '../../../lib/api';
import { isAuthed, json, unauthorized } from '../../../lib/auth';
import { deletePost, getPostRecord, savePost } from '../../../lib/db';
import { normalizePost, ValidationError } from '../../../lib/validate';
import type { Post } from '../../../lib/types';

export const GET: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const record = await getPostRecord(slug);
    if (!record) return json({ error: '文章不存在' }, { status: 404 });
    return json({ post: record.post, version: record.version });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

/** 整体替换；带 If-Match 时做乐观锁。 */
export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const body = await readJson(request);
    const current = await getPostRecord(slug);
    const { version: expected } = readIfMatch(request);
    if (expected && (!current || current.version !== expected)) {
      return current ? conflict(current.version) : preconditionFailed();
    }
    const normalized = normalizePost(slug, body.post);
    if (isDryRun(request)) {
      return json({
        ok: true,
        dryRun: true,
        slug,
        post: normalized,
        version: current?.version ?? null,
      });
    }
    const version = await savePost(normalized);
    return json({ ok: true, slug, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};

/** 局部更新：只改传入的字段，其余保持原样。 */
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const body = await readJson(request);
    const current = await getPostRecord(slug);
    if (!current) return json({ error: '文章不存在' }, { status: 404 });
    const { version: expected } = readIfMatch(request);
    if (expected && current.version !== expected) return conflict(current.version);

    const patch = (body.post && typeof body.post === 'object' ? body.post : body) as Partial<Post>;
    const merged: Post = {
      ...current.post,
      ...patch,
      // slug 不接受通过 PATCH 修改
      slug,
    };
    const normalized = normalizePost(slug, merged);
    if (isDryRun(request)) {
      return json({
        ok: true,
        dryRun: true,
        slug,
        post: normalized,
        version: current.version,
      });
    }
    const version = await savePost(normalized);
    return json({ ok: true, slug, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const { version: expected } = readIfMatch(request);
    if (isDryRun(request)) {
      const current = await getPostRecord(slug);
      if (!current) return json({ error: '文章不存在' }, { status: 404 });
      if (expected && current.version !== expected) return conflict(current.version);
      return json({ ok: true, dryRun: true, wouldDelete: slug, version: current.version });
    }
    const outcome = await deletePost(slug, expected);
    if (outcome === 'missing') return json({ error: '文章不存在' }, { status: 404 });
    if (outcome === 'conflict') {
      const current = await getPostRecord(slug);
      return conflict(current?.version ?? '');
    }
    return json({ ok: true, deleted: slug });
  } catch (error) {
    return json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
};
