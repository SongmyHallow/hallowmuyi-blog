import { isAuthed, unauthorized, listGames, normalizeGame, putGame } from './_lib';

// GET /api/games —— 列出游戏书架
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  try {
    const games = await listGames(env as any);
    return Response.json({ games });
  } catch {
    return Response.json({ error: '读取失败' }, { status: 500 });
  }
};

// POST /api/games  { slug, game } —— 新建游戏
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { slug, game } = (await request.json().catch(() => ({}))) as { slug?: string; game?: unknown };
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return Response.json({ error: 'slug 只能包含小写字母、数字、连字符' }, { status: 400 });
  }
  let normalized;
  try {
    normalized = normalizeGame(game);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
  try {
    await putGame(env as any, slug, normalized);
  } catch {
    return Response.json({ error: '保存失败' }, { status: 500 });
  }
  return Response.json({ ok: true });
};
