import type { APIRoute } from 'astro';
import { isAuthed, json } from '../../lib/auth';
import { countRecentComments, createComment, getPost, listApprovedComments, listComments } from '../../lib/db';
import type { CommentStatus } from '../../lib/types';
import { ValidationError, normalizeComment } from '../../lib/validate';

/** 同一 IP 在窗口内的提交上限与窗口长度。 */
const RATE_LIMIT = 3;
const RATE_WINDOW_MINUTES = 10;

const STATUSES: CommentStatus[] = ['pending', 'approved', 'hidden'];

function clientIp(request: Request): string {
  const direct = request.headers.get('cf-connecting-ip');
  if (direct) return direct.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '';
  return 'unknown';
}

/** IP 只存哈希，既够限流用，又不会把访客 IP 落库。 */
async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`comment:${ip}`));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  try {
    // 带管理凭据时返回完整列表（含邮箱与状态），供后台审核
    if (await isAuthed(request)) {
      const rawStatus = url.searchParams.get('status')?.trim() ?? '';
      const status = STATUSES.includes(rawStatus as CommentStatus) ? (rawStatus as CommentStatus) : undefined;
      return json({ comments: await listComments({ status }) });
    }

    const slug = url.searchParams.get('slug')?.trim() ?? '';
    if (!slug) return json({ error: '缺少 slug 参数' }, { status: 400 });
    return json(
      { comments: await listApprovedComments(slug) },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } }
    );
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') body = {};
  } catch {
    return json({ error: '请求格式错误' }, { status: 400 });
  }

  // 蜜罐：真实访客看不到这个字段，填了就当机器人，返回成功但不落库
  if (typeof body.website === 'string' && body.website.trim()) {
    return json({ ok: true, pending: true }, { status: 201 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug) return json({ error: '缺少文章 slug' }, { status: 400 });

  try {
    const post = await getPost(slug);
    if (!post || post.draft) return json({ error: '文章不存在' }, { status: 404 });

    const input = normalizeComment(body);

    const ipHash = await hashIp(clientIp(request));
    const recent = await countRecentComments(ipHash, RATE_WINDOW_MINUTES);
    if (recent >= RATE_LIMIT) {
      return json({ error: '提交太频繁了，请过一会儿再试' }, { status: 429 });
    }

    const id = await createComment({ slug, ...input, ipHash });
    return json({ ok: true, pending: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, { status: 400 });
    return json({ error: (error as Error).message || '提交失败' }, { status: 500 });
  }
};
