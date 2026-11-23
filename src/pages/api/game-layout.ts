import type { APIRoute } from 'astro';
import { conflict, isDryRun, preconditionFailed, readIfMatch, readJson } from '../../lib/api';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getGameLayout, listGameRecords, saveGameLayout } from '../../lib/db';
import { normalizeGameLayout, ValidationError } from '../../lib/validate';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const record = await getGameLayout();
    return json({ layout: record.layout, version: record.version });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const body = await readJson(request);
    const current = await getGameLayout();
    const { version: expected } = readIfMatch(request);
    if (expected && current.version !== expected) {
      return current.version ? conflict(current.version) : preconditionFailed();
    }

    const records = await listGameRecords({ includeDrafts: true });
    const layout = normalizeGameLayout(body.layout ?? body, records.map((record) => record.game));
    if (isDryRun(request)) {
      return json({ ok: true, dryRun: true, layout, version: current.version });
    }
    const version = await saveGameLayout(layout);
    return json({ ok: true, layout, version });
  } catch (error) {
    const status = error instanceof ValidationError ? 400 : 500;
    return json({ error: (error as Error).message || '保存失败' }, { status });
  }
};
