import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../../lib/auth';
import { deleteComment, getComment, setCommentStatus } from '../../../lib/db';
import type { CommentStatus } from '../../../lib/types';

const STATUSES: CommentStatus[] = ['pending', 'approved', 'hidden'];

function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PATCH: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const id = parseId(params.id);
  if (!id) return json({ error: '评论 id 不合法' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return json({ error: '请求格式错误' }, { status: 400 });
  }

  const status = String(body.status ?? '') as CommentStatus;
  if (!STATUSES.includes(status)) {
    return json({ error: '状态只能是 pending / approved / hidden' }, { status: 400 });
  }

  try {
    if (!(await getComment(id))) return json({ error: '评论不存在' }, { status: 404 });
    await setCommentStatus(id, status);
    return json({ ok: true, id, status });
  } catch (error) {
    return json({ error: (error as Error).message || '更新失败' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const id = parseId(params.id);
  if (!id) return json({ error: '评论 id 不合法' }, { status: 400 });

  try {
    if (!(await deleteComment(id))) return json({ error: '评论不存在' }, { status: 404 });
    return json({ ok: true, deleted: id });
  } catch (error) {
    return json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
};
