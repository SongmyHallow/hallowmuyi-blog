import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isSecureRequest, json, makeSessionCookie } from '../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, { status: 400 });
  }
  const expected = env.ADMIN_PASSWORD ?? '';
  if (!expected) {
    return json({ error: '服务端未配置 ADMIN_PASSWORD' }, { status: 500 });
  }
  if (String(body.password ?? '') !== expected) {
    return json({ error: '密码错误' }, { status: 401 });
  }
  const cookie = await makeSessionCookie(isSecureRequest(request));
  if (!cookie) {
    return json({ error: '服务端未配置 ADMIN_PASSWORD' }, { status: 500 });
  }
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
};
