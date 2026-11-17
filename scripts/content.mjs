#!/usr/bin/env node
// 博客内容 CLI：给脚本和 agent 用的薄封装，直接调用 /api/*。
//
// 认证用 Bearer token（环境变量 BLOG_API_TOKEN），不需要处理 cookie。
// 也可以把 base URL 换成 http://localhost:4321 在本地开发时使用。
//
// 用法：
//   node scripts/content.mjs <resource> <action> [slug] [flags]
//
//   node scripts/content.mjs posts list
//   node scripts/content.mjs posts list --q 像素 --full
//   node scripts/content.mjs posts get hello-world --json
//   node scripts/content.mjs posts create --file post.json
//   node scripts/content.mjs posts update hello-world --file patch.json
//   node scripts/content.mjs posts delete hello-world
//   node scripts/content.mjs games list
//   node scripts/content.mjs games upsert --file hades.json
//   node scripts/content.mjs games update hades --file patch.json
//   node scripts/content.mjs about get --json
//   node scripts/content.mjs about update --file about.md
//   node scripts/content.mjs export --out content.json
//   node scripts/content.mjs schema
//
// 环境变量：
//   BLOG_API_TOKEN   管理 token（必填；也可用 --token）
//   BLOG_BASE_URL    站点地址，默认 https://hallowmuyi.space（也可用 --base-url）
//
// 约定：--file 里的 JSON 顶层带 slug，例如
//   { "slug": "hades", "title": "哈迪斯", "cover": "https://...", "addedAt": "2026-11-14" }
// update / upsert 只写要改的字段，服务端会做字段合并（数组整体替换）。
// 默认带乐观锁：先读 version 再用 If-Match 提交；--force 可跳过检查。
import { readFileSync, writeFileSync } from 'node:fs';

const USAGE = `用法: node scripts/content.mjs <resource> <action> [slug] [flags]

资源与动作:
  posts list|get <slug>|create|update <slug>|delete <slug>
  games list|get <slug>|create|update <slug>|upsert|delete <slug>
  about get|update
  export
  schema

flags:
  --file <path>      create/update/upsert 的数据文件（JSON；about update 可用 Markdown）
  --json             输出原始 JSON
  --out <path>       export 时写入文件
  --q <keyword>      list 时按关键词过滤
  --full             posts list 时返回完整文章
  --dry-run          只校验不落库（服务端 ?dryRun=1）
  --force            跳过 If-Match 乐观锁，强制覆盖
  --if-match <ver>   手动指定版本号（默认自动读取 GET 返回的 version）
  --token <token>    覆盖 BLOG_API_TOKEN
  --base-url <url>   覆盖 BLOG_BASE_URL
  --help             显示本帮助

环境变量:
  BLOG_API_TOKEN     管理 token（必填）
  BLOG_BASE_URL      默认 https://hallowmuyi.space`;

function fail(message, code = 1) {
  console.error(`错误: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const valueFlags = new Set(['file', 'token', 'base-url', 'out', 'q', 'if-match']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split('=', 2);
    if (valueFlags.has(name)) {
      const value = inline ?? argv[++i];
      if (value === undefined) fail(`--${name} 缺少值`, 2);
      flags[name] = value;
    } else {
      flags[name] = true;
    }
  }
  return { flags, positional };
}

function readBodyFile(path) {
  if (!path) fail('缺少 --file <path>', 2);
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** 从 { slug, ...rest } 里拆出 slug 和实体字段。 */
function splitSlug(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    fail('--file 内容必须是 JSON 对象', 2);
  }
  const { slug, ...entity } = data;
  if (typeof slug !== 'string' || !slug.trim()) fail('--file 内容缺少 slug 字段', 2);
  return { slug: slug.trim(), entity };
}

/** 读取 --file：create/upsert 需要顶层 slug，update 时 slug 来自命令行，可省略。 */
function readEntityFile(path, fallbackSlug) {
  const data = readBodyFile(path);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    fail('--file 内容必须是 JSON 对象', 2);
  }
  if (fallbackSlug) {
    const { slug: _ignored, ...entity } = data;
    return { slug: fallbackSlug, entity };
  }
  return splitSlug(data);
}

function withQuery(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === true) query.set(key, '1');
    else if (typeof value === 'string' && value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

function makeClient(baseUrl, token) {
  /** 返回 { ok, status, data }，不主动退出；调用方用 expect() 决定怎么报错。 */
  async function request(method, path, body, options = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    Object.assign(headers, options.headers ?? {});
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      fail(`无法连接 ${baseUrl}: ${error.message}`);
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: response.ok, status: response.status, data };
  }

  function expect(result, context = '') {
    if (result.ok) return result.data;
    const message =
      (result.data && (result.data.error || result.data.message)) ||
      `${result.status}`;
    if (result.status === 401) {
      fail(`认证失败（401）：${message}。请确认 BLOG_API_TOKEN 与服务端 API_TOKEN 一致。`);
    }
    if (result.status === 409) {
      const version = result.data?.version ? ` 当前版本：${result.data.version}` : '';
      fail(`版本冲突（409）：${message}。${version} 重新读取后重试，或加 --force。`);
    }
    if (result.status === 404) fail(`${context ? `${context}：` : ''}${message}（404）`);
    fail(`${method} ${path} 失败（${result.status}）：${message}`);
  }

  return { request, expect };
}

/** 先 GET 拿 version，再用 PATCH + If-Match 提交；409 时重读再试一次。 */
async function patchEntity(client, path, wrapper, entity, flags) {
  const forced = Boolean(flags.force);
  const explicit = flags['if-match'];
  let version = explicit || null;

  if (!version && !forced) {
    const current = client.expect(await client.request('GET', path), path);
    version = current.version ?? null;
  }

  const options = version ? { headers: { 'If-Match': version } } : {};
  const dryRun = Boolean(flags['dry-run']);
  const target = withQuery(path, { dryRun });

  let result = await client.request('PATCH', target, { [wrapper]: entity }, options);
  if (!result.ok && result.status === 409 && !forced) {
    const current = client.expect(await client.request('GET', path), path);
    const retryOptions = current.version ? { headers: { 'If-Match': current.version } } : {};
    result = await client.request('PATCH', target, { [wrapper]: entity }, retryOptions);
  }
  return client.expect(result, `${path} 更新`);
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  if (flags.help || positional.length === 0) {
    console.log(USAGE);
    process.exit(positional.length === 0 && !flags.help ? 2 : 0);
  }

  const baseUrl = String(flags['base-url'] || process.env.BLOG_BASE_URL || 'https://hallowmuyi.space').replace(/\/$/, '');
  const token = String(flags.token || process.env.BLOG_API_TOKEN || '').trim();
  if (!token) fail('缺少 token：设置 BLOG_API_TOKEN 环境变量或传 --token', 2);

  const [resource, action, slug] = positional;
  const client = makeClient(baseUrl, token);
  const print = (data) => console.log(JSON.stringify(data, null, 2));
  const dryRun = Boolean(flags['dry-run']);

  switch (`${resource} ${action ?? ''}`.trim()) {
    case 'posts list': {
      const path = withQuery('/api/posts', { q: flags.q, full: flags.full });
      const data = client.expect(await client.request('GET', path), 'posts list');
      if (flags.json) return print(data);
      for (const post of data.posts) console.log(`${post.slug}\t${post.title}`);
      return;
    }
    case 'posts get': {
      if (!slug) fail('posts get 需要 slug', 2);
      const data = client.expect(
        await client.request('GET', `/api/posts/${encodeURIComponent(slug)}`),
        'posts get'
      );
      return print(flags.json ? data : data.post);
    }
    case 'posts create': {
      const { slug: newSlug, entity } = splitSlug(readBodyFile(flags.file));
      const path = withQuery('/api/posts', { dryRun });
      const data = client.expect(
        await client.request('POST', path, { slug: newSlug, post: entity }),
        'posts create'
      );
      return print(flags.json ? data : { ok: true, slug: newSlug, version: data.version });
    }
    case 'posts update': {
      if (!slug) fail('posts update 需要 slug', 2);
      const { entity } = readEntityFile(flags.file, slug);
      const data = await patchEntity(client, `/api/posts/${encodeURIComponent(slug)}`, 'post', entity, flags);
      return print(flags.json ? data : { ok: true, slug, version: data.version });
    }
    case 'posts delete': {
      if (!slug) fail('posts delete 需要 slug', 2);
      const path = `/api/posts/${encodeURIComponent(slug)}`;
      let version = flags['if-match'] || null;
      if (!version && !flags.force) {
        const current = client.expect(await client.request('GET', path), 'posts delete');
        version = current.version ?? null;
      }
      const data = client.expect(
        await client.request('DELETE', withQuery(path, { dryRun }), undefined, {
          headers: version ? { 'If-Match': version } : {},
        }),
        'posts delete'
      );
      return print(flags.json ? data : { ok: true, deleted: slug });
    }

    case 'games list': {
      const path = withQuery('/api/games', { q: flags.q });
      const data = client.expect(await client.request('GET', path), 'games list');
      if (flags.json) return print(data);
      for (const game of data.games) console.log(`${game.slug}\t${game.title}${game.draft ? '\t(draft)' : ''}`);
      return;
    }
    case 'games get': {
      if (!slug) fail('games get 需要 slug', 2);
      const data = client.expect(
        await client.request('GET', `/api/games/${encodeURIComponent(slug)}`),
        'games get'
      );
      return print(flags.json ? data : data.game);
    }
    case 'games create': {
      const { slug: newSlug, entity } = splitSlug(readBodyFile(flags.file));
      const path = withQuery('/api/games', { dryRun });
      const data = client.expect(
        await client.request('POST', path, { slug: newSlug, game: entity }),
        'games create'
      );
      return print(flags.json ? data : { ok: true, slug: newSlug, version: data.version });
    }
    case 'games update': {
      if (!slug) fail('games update 需要 slug', 2);
      const { entity } = readEntityFile(flags.file, slug);
      const data = await patchEntity(client, `/api/games/${encodeURIComponent(slug)}`, 'game', entity, flags);
      return print(flags.json ? data : { ok: true, slug, version: data.version });
    }
    case 'games upsert': {
      const { slug: target, entity } = splitSlug(readBodyFile(flags.file));
      const path = `/api/games/${encodeURIComponent(target)}`;
      const existing = await client.request('GET', path);
      if (existing.ok) {
        const data = await patchEntity(client, path, 'game', entity, flags);
        return print(flags.json ? data : { ok: true, slug: target, action: 'updated', version: data.version });
      }
      const createData = client.expect(
        await client.request('POST', withQuery('/api/games', { dryRun }), { slug: target, game: entity }),
        'games upsert'
      );
      return print(flags.json ? createData : { ok: true, slug: target, action: 'created', version: createData.version });
    }
    case 'games delete': {
      if (!slug) fail('games delete 需要 slug', 2);
      const path = `/api/games/${encodeURIComponent(slug)}`;
      let version = flags['if-match'] || null;
      if (!version && !flags.force) {
        const current = client.expect(await client.request('GET', path), 'games delete');
        version = current.version ?? null;
      }
      const data = client.expect(
        await client.request('DELETE', withQuery(path, { dryRun }), undefined, {
          headers: version ? { 'If-Match': version } : {},
        }),
        'games delete'
      );
      return print(flags.json ? data : { ok: true, deleted: slug });
    }

    case 'about get': {
      const data = client.expect(await client.request('GET', '/api/about'), 'about get');
      return print(flags.json ? data : data.body);
    }
    case 'about update':
    case 'about patch': {
      const raw = readBodyFile(flags.file);
      const body = typeof raw === 'string' ? raw : raw.body;
      if (typeof body !== 'string' || !body.trim()) fail('--file 里没有可用的正文（.md 文件或 {"body": "..."})', 2);
      const current = client.expect(await client.request('GET', '/api/about'), 'about get');
      const version = flags.force ? null : flags['if-match'] || current.version || null;
      const data = client.expect(
        await client.request(
          'PATCH',
          withQuery('/api/about', { dryRun }),
          { body },
          { headers: version ? { 'If-Match': version } : {} }
        ),
        'about update'
      );
      return print(flags.json ? data : { ok: true, updated: 'about', version: data.version });
    }

    case 'export': {
      const [posts, games, about] = await Promise.all([
        client.request('GET', '/api/posts?full=1&q='),
        client.request('GET', '/api/games'),
        client.request('GET', '/api/about'),
      ]);
      const postsData = client.expect(posts, 'export posts');
      const gamesData = client.expect(games, 'export games');
      const aboutData = client.expect(about, 'export about');
      const payload = {
        exportedAt: new Date().toISOString(),
        posts: postsData.posts,
        games: gamesData.games,
        about: aboutData.body,
      };
      if (flags.out) {
        writeFileSync(flags.out, JSON.stringify(payload, null, 2));
        console.log(`已导出到 ${flags.out}（${payload.posts.length} 篇文章、${payload.games.length} 个游戏）`);
      } else {
        print(payload);
      }
      return;
    }

    case 'schema': {
      const data = client.expect(await client.request('GET', '/api/schema'), 'schema');
      return print(data);
    }

    default:
      fail(`未知命令: ${positional.join(' ')}\n\n${USAGE}`, 2);
  }
}

main().catch((error) => fail(error.message || String(error)));
