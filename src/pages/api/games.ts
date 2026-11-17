import type { APIRoute } from 'astro';
import { isDryRun, readJson, searchQuery } from '../../lib/api';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getGameRecord, listGameRecords, saveGame } from '../../lib/db';
import { normalizeGame, ValidationError } from '../../lib/validate';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const records = await listGameRecords({
      includeDrafts: true,
      q: searchQuery(request),
    });
    return json({
      games: records.map(({ game, version }) => ({ ...game, version })),
    });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const body = await readJson(request);
    const normalized = normalizeGame(String(body.slug ?? ''), body.game);
    if (await getGameRecord(normalized.slug)) {
      return json({ error: 'slug 已存在，请换一个' }, { status: 400 });
    }
    if (isDryRun(request)) {
      return json({ ok: true, dryRun: true, slug: normalized.slug, version: null });
    }
    const version = await saveGame(normalized);
    return json({ ok: true, slug: normalized.slug, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};
