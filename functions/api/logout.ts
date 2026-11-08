import { clearSessionCookie } from './_lib';

// POST /api/logout
export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
};
