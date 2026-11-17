import { env } from 'cloudflare:workers';

const COOKIE_NAME = 'hm_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getSecret(): string {
  return env.ADMIN_PASSWORD ?? '';
}

/** 生成 Set-Cookie 头。isSecure 用于决定是否带 Secure 属性（本地 http 开发时不需要）。 */
export async function makeSessionCookie(secure: boolean): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const signature = await sign(secret, String(exp));
  const parts = [
    `${COOKIE_NAME}=${exp}.${signature}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function isAuthed(request: Request): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const header = request.headers.get('Cookie') ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [expRaw, signature] = decodeURIComponent(match[1]).split('.');
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  if (!signature) return false;
  const expected = await sign(secret, expRaw);
  return timingSafeEqual(signature, expected);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: '未登录' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}

export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}
