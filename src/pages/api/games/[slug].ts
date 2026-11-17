import type { APIRoute } from 'astro';
import { conflict, isDryRun, preconditionFailed, readIfMatch, readJson } from '../../../lib/api';
import { isAuthed, json, unauthorized } from '../../../lib/auth';
import { deleteGame, getGameRecord, saveGame } from '../../../lib/db';
import { normalizeGame, ValidationError } from '../../../lib/validate';
import type { Game } from '../../../lib/types';

export const GET: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const record = await getGameRecord(slug);
    if (!record) return json({ error: '游戏不存在' }, { status: 404 });
    return json({ game: record.game, version: record.version });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const body = await readJson(request);
    const current = await getGameRecord(slug);
    const { version: expected } = readIfMatch(request);
    if (expected && (!current || current.version !== expected)) {
      return current ? conflict(current.version) : preconditionFailed();
    }
    const normalized = normalizeGame(slug, body.game);
    if (isDryRun(request)) {
      return json({
        ok: true,
        dryRun: true,
        slug,
        game: normalized,
        version: current?.version ?? null,
      });
    }
    const version = await saveGame(normalized);
    return json({ ok: true, slug, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};

/** 局部更新：数组字段整体替换，其余字段保持原样。 */
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!(await isAuthed(request))) return unauthorized();
  const slug = params.slug ?? '';
  try {
    const body = await readJson(request);
    const current = await getGameRecord(slug);
    if (!current) return json({ error: '游戏不存在' }, { status: 404 });
    const { version: expected } = readIfMatch(request);
    if (expected && current.version !== expected) return conflict(current.version);

    const patch = (body.game && typeof body.game === 'object' ? body.game : body) as Partial<Game>;
    const merged: Game = { ...current.game, ...patch, slug };
    const normalized = normalizeGame(slug, merged);
    if (isDryRun(request)) {
      return json({
        ok: true,
        dryRun: true,
        slug,
        game: normalized,
        version: current.version,
      });
    }
    const version = await saveGame(normalized);
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
      const current = await getGameRecord(slug);
      if (!current) return json({ error: '游戏不存在' }, { status: 404 });
      if (expected && current.version !== expected) return conflict(current.version);
      return json({ ok: true, dryRun: true, wouldDelete: slug, version: current.version });
    }
    const outcome = await deleteGame(slug, expected);
    if (outcome === 'missing') return json({ error: '游戏不存在' }, { status: 404 });
    if (outcome === 'conflict') {
      const current = await getGameRecord(slug);
      return conflict(current?.version ?? '');
    }
    return json({ ok: true, deleted: slug });
  } catch (error) {
    return json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
};
