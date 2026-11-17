import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getGame, listGames, saveGame } from '../../lib/db';
import { normalizeGame, ValidationError } from '../../lib/validate';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const games = await listGames({ includeDrafts: true });
    return json({ games });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const { slug, game } = (await request.json()) as { slug?: unknown; game?: unknown };
    const normalized = normalizeGame(String(slug ?? ''), game);
    if (await getGame(normalized.slug)) {
      return json({ error: 'slug 已存在，请换一个' }, { status: 400 });
    }
    await saveGame(normalized);
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};
