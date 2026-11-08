import { isAuthed, unauthorized, listPosts, putPost, composeMarkdown } from './_lib';
import type { PostInput } from './_lib';

// GET /api/posts  —— 列出文章（需登录，也用作登录态探测）
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const posts = await listPosts(env as any);
  return Response.json({ posts });
};

// POST /api/posts  { slug, post } —— 新建文章
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { slug, post } = (await request.json()) as { slug: string; post: PostInput };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return Response.json({ error: 'slug 只能包含小写字母、数字、连字符' }, { status: 400 });
  }
  if (!post?.title || !post?.body) {
    return Response.json({ error: '标题和正文必填' }, { status: 400 });
  }
  await putPost(env as any, slug, composeMarkdown(post));
  return Response.json({ ok: true });
};
