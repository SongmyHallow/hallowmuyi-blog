import { isAuthed, unauthorized, getGame, normalizeGame, putGame, deleteGame } from '../_lib';

type Ctx = { request: Request; env: unknown; params: { slug: string } };

// GitHub 文件不存在
function isNotFound(err: unknown): boolean {
  return err instanceof Error && /github get failed: 404/.test(err.message);
}

// GET /api/games/:slug —— 读取游戏（编辑用）
export const onRequestGet: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  try {
    const { sha, game } = await getGame(env as any, params.slug);
    return Response.json({ sha, game });
  } catch (err) {
    if (isNotFound(err)) return Response.json({ error: '游戏不存在' }, { status: 404 });
    return Response.json({ error: '读取失败' }, { status: 500 });
  }
};

// PUT /api/games/:slug  { game } —— 更新
export const onRequestPut: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { game } = (await request.json().catch(() => ({}))) as { game?: unknown };
  let normalized;
  try {
    normalized = normalizeGame(game);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  const existing = await getGame(env as any, params.slug).catch(() => null);
  if (!existing) return Response.json({ error: '游戏不存在' }, { status: 404 });
  try {
    await putGame(env as any, params.slug, normalized, existing.sha);
  } catch {
    return Response.json({ error: '保存失败' }, { status: 500 });
  }
  return Response.json({ ok: true });
};

// DELETE /api/games/:slug —— 删除
export const onRequestDelete: PagesFunction = async ({ request, env, params }: Ctx) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const existing = await getGame(env as any, params.slug).catch(() => null);
  if (!existing) return Response.json({ error: '游戏不存在' }, { status: 404 });
  try {
    await deleteGame(env as any, params.slug, existing.sha);
  } catch {
    return Response.json({ error: '删除失败' }, { status: 500 });
  }
  return Response.json({ ok: true });
};
