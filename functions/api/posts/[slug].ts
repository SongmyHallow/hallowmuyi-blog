import { isAuthed, unauthorized, getPost, putPost, deletePost, composeMarkdown, parseMarkdown } from '../_lib';
import type { PostInput } from '../_lib';

type Ctx = { request: Request; env: unknown; params: { slug: string } };

// GET /api/posts/:slug —— 读取一篇文章（编辑用）
export const onRequestGet: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { content, sha } = await getPost(env as any, params.slug);
  return Response.json({ sha, post: parseMarkdown(content) });
};

// PUT /api/posts/:slug  { post } —— 更新
export const onRequestPut: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { post } = (await request.json()) as { post: PostInput };
  if (!post?.title || !post?.body) {
    return Response.json({ error: '标题和正文必填' }, { status: 400 });
  }
  const { sha } = await getPost(env as any, params.slug);
  await putPost(env as any, params.slug, composeMarkdown(post), sha);
  return Response.json({ ok: true });
};

// DELETE /api/posts/:slug —— 删除
export const onRequestDelete: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { sha } = await getPost(env as any, params.slug);
  await deletePost(env as any, params.slug, sha);
  return Response.json({ ok: true });
};
