import type { APIRoute } from 'astro';
import { isAuthed, json, unauthorized } from '../../../lib/auth';
import { deleteGame, getGame, saveGame } from '../../../lib/db';
import { normalizeGame, ValidationError } from '../../../lib/validate';

export const GET: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const game = await getGame(params.slug ?? '');
    if (!game) return json({ error: '游戏不存在' }, { status: 404 });
    return json({ game });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const { game } = (await request.json()) as { game?: unknown };
    await saveGame(normalizeGame(params.slug ?? '', game));
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    await deleteGame(params.slug ?? '');
    return json({ ok: true });
  } catch (error) {
    return json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
};
