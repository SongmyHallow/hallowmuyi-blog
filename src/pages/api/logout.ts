import type { APIRoute } from 'astro';
import { clearSessionCookie, json } from '../../lib/auth';

export const POST: APIRoute = async () => {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
