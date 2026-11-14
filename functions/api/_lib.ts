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
  title: string; // frontmatter 里的标题，解析失败时回落为 slug
}

// 从 Markdown 的 frontmatter 中取出 title
function parseTitle(markdown: string): string | null {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const line = fm[1].match(/^title:\s*(.+)$/m);
  if (!line) return null;
  return line[1].trim().replace(/^['"]|['"]$/g, '');
}

export async function listPosts(env: Env): Promise<PostFile[]> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/src/content/blog`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`github list failed: ${res.status}`);
  const files: { name: string; sha: string }[] = await res.json();
  const posts: PostFile[] = files
    .filter((f) => f.name.endsWith('.md'))
    .map((f) => {
      const slug = f.name.replace(/\.md$/, '');
      return { name: f.name, slug, sha: f.sha, title: slug };
    });
  // 并行读取每篇的 frontmatter 取标题；单篇失败不影响列表
  await Promise.all(
    posts.map(async (p) => {
      try {
        const { content } = await getPost(env, p.slug);
        p.title = parseTitle(content) ?? p.slug;
      } catch {
        /* 保留 slug 兜底 */
      }
    })
  );
  return posts;
}

export async function getFile(env: Env, path: string): Promise<{ sha: string; content: string }> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/${path}`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) throw new Error(`github get failed: ${res.status}`);
  const data: { sha: string; content: string } = await res.json();
  // GitHub 返回 base64（可能带换行）
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return { sha: data.sha, content: new TextDecoder().decode(bytes) };
}

export async function getPost(env: Env, slug: string): Promise<{ sha: string; content: string }> {
  return getFile(env, `src/content/blog/${slug}.md`);
}

function toBase64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export async function putFile(env: Env, path: string, content: string, message: string, sha?: string): Promise<void> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: ghHeaders(env),
      body: JSON.stringify({
        message,
        content: toBase64(content),
        branch: 'master',
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!res.ok) throw new Error(`github put failed: ${res.status} ${await res.text()}`);
}

export async function putPost(env: Env, slug: string, content: string, sha?: string): Promise<void> {
  await putFile(env, `src/content/blog/${slug}.md`, content, sha ? `post: update ${slug}` : `post: new ${slug}`, sha);
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

// ---- 游戏书架（JSON 文件） ----

const GAMES_DIR = 'src/content/games';
const GAME_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface GameScore {
  source: string;
  score: string;
}

export interface GameLink {
  title: string;
  url: string;
  type: 'article' | 'video';
  note?: string;
  date?: string;
}

export interface GameUpdate {
  version: string;
  date: string;
  summary: string;
  url?: string;
}

export interface GameInput {
  title: string;
  originalTitle?: string;
  cover: string;
  summary?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  addedAt: string;
  updatedAt: string;
  platforms: string[];
  genres: string[];
  officialUrl?: string;
  scores: GameScore[];
  relatedPosts: string[];
  links: GameLink[];
  timeline: GameUpdate[];
  draft: boolean;
}

export interface GameFile {
  slug: string;
  title: string;
  cover: string;
  draft: boolean;
  addedAt: string;
  updatedAt?: string;
}

function assertGameSlug(slug: string): void {
  if (!GAME_SLUG_RE.test(slug)) throw new Error('slug 不合法');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// 只接受字符串/数字，避免把对象转成 "[object Object]"
function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function optionalText(value: unknown): string | undefined {
  return text(value) || undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 合法的 YYYY-MM-DD（同时排除 2024-02-31 这类溢出日期）
function validDate(value: unknown): string | undefined {
  const s = text(value);
  if (!s || !DATE_RE.test(s)) return undefined;
  const date = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s) return undefined;
  return s;
}

function normalizeDate(value: unknown, error: string): string | undefined {
  if (value === undefined || value === null || text(value) === '') return undefined;
  const date = validDate(value);
  if (!date) throw new Error(error);
  return date;
}

// 去空、去空白、去重
function uniqStrings(value: unknown): string[] {
  const out: string[] = [];
  for (const item of asArray(value)) {
    const s = text(item);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

// 游戏条目「最近编辑日期」按北京时间取当天，避免 UTC 与本地日期错位
function todayInShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function normalizeGame(input: unknown): GameInput {
  const raw = asRecord(input);

  const title = text(raw.title);
  if (!title) throw new Error('标题必填');

  const cover = text(raw.cover);
  if (!cover || !isHttpUrl(cover)) throw new Error('封面图 URL 不合法');

  const addedAt = normalizeDate(raw.addedAt, '加入书架日期不合法');
  if (!addedAt) throw new Error('加入书架日期不合法');

  const officialUrl = optionalText(raw.officialUrl);
  if (officialUrl && !isHttpUrl(officialUrl)) throw new Error('官网 URL 不合法');

  const scores: GameScore[] = [];
  for (const item of asArray(raw.scores)) {
    const score = asRecord(item);
    const source = text(score.source);
    const value = text(score.score);
    if (source && value) scores.push({ source, score: value });
  }

  const links: GameLink[] = [];
  for (const item of asArray(raw.links)) {
    const link = asRecord(item);
    const linkTitle = text(link.title);
    const url = text(link.url);
    if (!linkTitle || !url) continue;
    if (!isHttpUrl(url)) throw new Error('链接 URL 不合法');
    const entry: GameLink = {
      title: linkTitle,
      url,
      type: link.type === 'video' ? 'video' : 'article',
    };
    const note = optionalText(link.note);
    if (note) entry.note = note;
    const date = normalizeDate(link.date, '链接日期不合法');
    if (date) entry.date = date;
    links.push(entry);
  }

  const timeline: GameUpdate[] = [];
  for (const item of asArray(raw.timeline)) {
    const update = asRecord(item);
    const version = text(update.version);
    const summary = text(update.summary);
    const date = validDate(update.date);
    if (!version || !summary || !date) continue;
    const entry: GameUpdate = { version, date, summary };
    const url = optionalText(update.url);
    if (url) {
      if (!isHttpUrl(url)) throw new Error('更新链接 URL 不合法');
      entry.url = url;
    }
    timeline.push(entry);
  }

  const originalTitle = optionalText(raw.originalTitle);
  const summary = optionalText(raw.summary);
  const developer = optionalText(raw.developer);
  const publisher = optionalText(raw.publisher);
  const releaseDate = normalizeDate(raw.releaseDate, '发售日期不合法');

  return {
    title,
    ...(originalTitle ? { originalTitle } : {}),
    cover,
    ...(summary ? { summary } : {}),
    ...(developer ? { developer } : {}),
    ...(publisher ? { publisher } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    addedAt,
    // 更新时间统一由服务端写入，忽略客户端传值
    updatedAt: todayInShanghai(),
    platforms: uniqStrings(raw.platforms),
    genres: uniqStrings(raw.genres),
    ...(officialUrl ? { officialUrl } : {}),
    scores,
    relatedPosts: uniqStrings(raw.relatedPosts),
    links,
    timeline,
    draft: raw.draft === true || raw.draft === 'true',
  };
}

export async function listGames(env: Env): Promise<GameFile[]> {
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/${GAMES_DIR}`,
    { headers: ghHeaders(env) }
  );
  if (res.status === 404) return []; // 目录尚未创建
  if (!res.ok) throw new Error(`github list failed: ${res.status}`);
  const files: { name: string }[] = await res.json();
  const games = await Promise.all(
    files
      .filter((f) => f.name.endsWith('.json'))
      .map(async (f): Promise<GameFile | null> => {
        const slug = f.name.replace(/\.json$/, '');
        try {
          const { content } = await getFile(env, `${GAMES_DIR}/${f.name}`);
          const data = asRecord(JSON.parse(content));
          return {
            slug,
            title: text(data.title) || slug,
            cover: text(data.cover),
            draft: data.draft === true,
            addedAt: text(data.addedAt),
            updatedAt: optionalText(data.updatedAt),
          };
        } catch {
          return null; // 单个文件失败跳过，不影响整体列表
        }
      })
  );
  return games.filter((g): g is GameFile => g !== null);
}

export async function getGame(env: Env, slug: string): Promise<{ sha: string; game: unknown }> {
  assertGameSlug(slug);
  const { sha, content } = await getFile(env, `${GAMES_DIR}/${slug}.json`);
  try {
    return { sha, game: JSON.parse(content) };
  } catch {
    throw new Error(`游戏文件解析失败：${slug}.json`);
  }
}

export async function putGame(env: Env, slug: string, game: GameInput, sha?: string): Promise<void> {
  assertGameSlug(slug);
  const content = `${JSON.stringify(game, null, 2)}\n`;
  await putFile(
    env,
    `${GAMES_DIR}/${slug}.json`,
    content,
    sha ? `game: update ${slug}` : `game: new ${slug}`,
    sha
  );
}

export async function deleteGame(env: Env, slug: string, sha: string): Promise<void> {
  assertGameSlug(slug);
  const res = await fetch(
    `${GH_API}/repos/${env.GITHUB_REPO}/contents/${GAMES_DIR}/${slug}.json`,
    {
      method: 'DELETE',
      headers: ghHeaders(env),
      body: JSON.stringify({ message: `game: delete ${slug}`, sha, branch: 'master' }),
    }
  );
  if (!res.ok) throw new Error(`github delete failed: ${res.status}`);
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
