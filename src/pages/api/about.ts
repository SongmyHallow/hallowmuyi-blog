import type { APIRoute } from 'astro';
import { conflict, isDryRun, preconditionFailed, readIfMatch, readJson } from '../../lib/api';
import { isAuthed, json, unauthorized } from '../../lib/auth';
import { getPageRecord, savePage } from '../../lib/db';

const ABOUT_SLUG = 'about';
const ABOUT_TITLE = '关于';

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  try {
    const record = await getPageRecord(ABOUT_SLUG);
    return json({
      body: record?.page.body ?? '',
      title: record?.page.title ?? ABOUT_TITLE,
      version: record?.version ?? null,
    });
  } catch (error) {
    return json({ error: (error as Error).message || '读取失败' }, { status: 500 });
  }
};

async function save(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    if (typeof body.body !== 'string') {
      return json({ error: '正文格式错误' }, { status: 400 });
    }
    const current = await getPageRecord(ABOUT_SLUG);
    const { version: expected } = readIfMatch(request);
    if (expected && (!current || current.version !== expected)) {
      return current ? conflict(current.version) : preconditionFailed();
    }
    if (isDryRun(request)) {
      return json({ ok: true, dryRun: true, version: current?.version ?? null });
    }
    const version = await savePage({
      slug: ABOUT_SLUG,
      title: ABOUT_TITLE,
      body: body.body.trim(),
    });
    return json({ ok: true, version });
  } catch (error) {
    return json({ error: (error as Error).message || '保存失败' }, { status: 500 });
  }
}

export const PUT: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  return save(request);
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!(await isAuthed(request))) return unauthorized();
  return save(request);
};
