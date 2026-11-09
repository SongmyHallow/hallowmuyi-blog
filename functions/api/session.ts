import { isAuthed } from './_lib';

// GET /api/session —— 仅探测登录态，不返回敏感信息（未登录也返回 200）
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  return Response.json({ authed: await isAuthed(request, env as any) });
};
