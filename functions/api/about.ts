import { isAuthed, unauthorized, getFile, putFile } from './_lib';

const PATH = 'src/content/pages/about.md';

// GET /api/about —— 读取关于页 markdown 正文（不含 frontmatter）
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { content } = await getFile(env as any, PATH);
  const m = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return Response.json({ body: m ? m[1] : content });
};

// PUT /api/about  { body } —— 更新关于页
export const onRequestPut: PagesFunction = async ({ request, env }) => {
  if (!(await isAuthed(request, env as any))) return unauthorized();
  const { body } = (await request.json()) as { body?: string };
  if (!body?.trim()) {
    return Response.json({ error: '正文必填' }, { status: 400 });
  }
  const { sha } = await getFile(env as any, PATH);
  await putFile(env as any, PATH, `---\ntitle: 关于\n---\n\n${body.trim()}\n`, 'page: update about', sha);
  return Response.json({ ok: true });
};
