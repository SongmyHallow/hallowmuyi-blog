import type { APIRoute } from 'astro';
import { isAuthed, json } from '../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const authed = await isAuthed(request);
  return json({ authed });
};
