// 共享工具：管理员会话校验 + GitHub Contents API 封装
// 环境变量：ADMIN_PASSWORD / GITHUB_TOKEN / GITHUB_REPO（在 Cloudflare Pages 项目设置中配置）

interface Env {
  ADMIN_PASSWORD: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // 例：SongmyHallow/hallowmuyi-blog
}

const COOKIE_NAME = 'hm_admin';
const SESSION_TTL = 7 * 24 * 3600; // 7 天

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeSessionCookie(env: Env): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const sig = await hmac(env.ADMIN_PASSWORD, String(exp));
  return `${COOKIE_NAME}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_TTL}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function isAuthed(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return (await hmac(env.ADMIN_PASSWORD, exp)) === sig;
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

// ---- GitHub Contents API ----

const GH_API = 'https://api.github.com';

function ghHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hallowmuyi-blog-admin',
  };
}

export interface PostFile {
  name: string; // 文件名，如 hello-world.md
  slug: string;
  sha: string;
}

export async function listPosts(env: Env): Promise<PostFile[]> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/src/content/blog`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`github list failed: ${res.status}`);
  const files: { name: string; sha: string }[] = await res.json();
  return files
    .filter((f) => f.name.endsWith('.md'))
    .map((f) => ({ name: f.name, slug: f.name.replace(/\.md$/, ''), sha: f.sha }));
}

export async function getPost(env: Env, slug: string): Promise<{ sha: string; content: string }> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/src/content/blog/${slug}.md`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`github get failed: ${res.status}`);
  const data: { sha: string; content: string } = await res.json();
  // GitHub 返回 base64（可能带换行）
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { sha: data.sha, content: new TextDecoder().decode(bytes) };
}

function toBase64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export async function putPost(env: Env, slug: string, content: string, sha?: string): Promise<void> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/src/content/blog/${slug}.md`,
    {
      method: 'PUT',
      headers: ghHeaders(env),
      body: JSON.stringify({
        message: sha ? `post: update ${slug}` : `post: new ${slug}`,
        content: toBase64(content),
        branch: 'master',
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!res.ok) throw new Error(`github put failed: ${res.status} ${await res.text()}`);
}

export async function deletePost(env: Env, slug: string, sha: string): Promise<void> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/src/content/blog/${slug}.md`,
    {
      method: 'DELETE',
      headers: ghHeaders(env),
      body: JSON.stringify({ message: `post: delete ${slug}`, sha, branch: 'master' }),
    }
  );
  if (!res.ok) throw new Error(`github delete failed: ${res.status}`);
}

// ---- markdown 文件组装/解析 ----

export interface PostInput {
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
  tags: string[];
  draft: boolean;
  body: string;
}

export function composeMarkdown(p: PostInput): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');
  const lines = [
    '---',
    `title: "${esc(p.title)}"`,
    `date: ${p.date}`,
    p.description ? `description: "${esc(p.description)}"` : null,
    p.tags.length ? `tags: [${p.tags.map((t) => `"${esc(t)}"`).join(', ')}]` : null,
    p.draft ? 'draft: true' : null,
    '---',
    '',
    p.body.trim(),
    '',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function parseMarkdown(md: string): PostInput {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { title: '', date: '', tags: [], draft: false, body: md };
  const fm = m[1];
  const get = (key: string) => {
    const r = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
    return r ? r[1].trim().replace(/^"|"$/g, '').replace(/\\"/g, '"') : '';
  };
  const tagsRaw = get('tags');
  return {
    title: get('title'),
    date: get('date'),
    description: get('description') || undefined,
    tags: tagsRaw ? [...tagsRaw.matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [],
    draft: /^draft:\s*true/m.test(fm),
    body: m[2],
  };
}
