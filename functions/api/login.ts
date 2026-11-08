import { makeSessionCookie } from './_lib';

// POST /api/login  { password }
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || password !== (env as any).ADMIN_PASSWORD) {
    return Response.json({ error: '密码错误' }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': await makeSessionCookie(env as any),
    },
  });
};
