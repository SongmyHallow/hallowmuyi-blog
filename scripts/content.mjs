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
//
// 环境变量：
//   BLOG_API_TOKEN   管理 token（必填；也可用 --token）
//   BLOG_BASE_URL    站点地址，默认 https://hallowmuyi.space（也可用 --base-url）
//
// 约定：--file 里的 JSON 顶层带 slug，例如
//   { "slug": "hades", "title": "哈迪斯", "cover": "https://...", "addedAt": "2026-11-14" }
// update / upsert 会先读当前记录再做字段合并，只需写要改的字段。
import { readFileSync, writeFileSync } from 'node:fs';

const USAGE = `用法: node scripts/content.mjs <resource> <action> [slug] [flags]

资源与动作:
  posts list|get <slug>|create|update <slug>|delete <slug>
  games list|get <slug>|create|update <slug>|upsert|delete <slug>
  about get|update
  export

flags:
  --file <path>      create/update/upsert 的数据文件（JSON；about update 可用 Markdown）
  --json             输出原始 JSON
  --out <path>       export 时写入文件
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
  const valueFlags = new Set(['file', 'token', 'base-url', 'out']);
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

function makeClient(baseUrl, token) {
  async function request(method, path, body, options = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
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
    if (response.status === 404 && options.allow404) return null;
    if (!response.ok) {
      const message = (data && (data.error || data.message)) || `${response.status} ${response.statusText}`;
      if (response.status === 401) {
        fail(`认证失败（401）：${message}。请确认 BLOG_API_TOKEN 与服务端 API_TOKEN 一致。`);
      }
      fail(`${method} ${path} 失败（${response.status}）：${message}`);
    }
    return data;
  }
  return { request };
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
  const json = (data) => console.log(JSON.stringify(data, null, 2));

  switch (`${resource} ${action ?? ''}`.trim()) {
    case 'posts list': {
      const data = await client.request('GET', '/api/posts');
      if (flags.json) return json(data);
      for (const post of data.posts) console.log(`${post.slug}\t${post.title}`);
      return;
    }
    case 'posts get': {
      if (!slug) fail('posts get 需要 slug', 2);
      const data = await client.request('GET', `/api/posts/${encodeURIComponent(slug)}`);
      return json(flags.json ? data : data.post);
    }
    case 'posts create': {
      const { slug: newSlug, entity } = splitSlug(readBodyFile(flags.file));
      const data = await client.request('POST', '/api/posts', { slug: newSlug, post: entity });
      return json(flags.json ? data : { ok: true, slug: newSlug });
    }
    case 'posts update': {
      if (!slug) fail('posts update 需要 slug', 2);
      const current = await client.request('GET', `/api/posts/${encodeURIComponent(slug)}`);
      const { entity } = splitSlug(readBodyFile(flags.file));
      const merged = { ...current.post, ...entity };
      const data = await client.request('PUT', `/api/posts/${encodeURIComponent(slug)}`, { post: merged });
      return json(flags.json ? data : { ok: true, slug, updated: Object.keys(entity) });
    }
    case 'posts delete': {
      if (!slug) fail('posts delete 需要 slug', 2);
      const data = await client.request('DELETE', `/api/posts/${encodeURIComponent(slug)}`);
      return json(flags.json ? data : { ok: true, deleted: slug });
    }

    case 'games list': {
      const data = await client.request('GET', '/api/games');
      if (flags.json) return json(data);
      for (const game of data.games) console.log(`${game.slug}\t${game.title}${game.draft ? '\t(draft)' : ''}`);
      return;
    }
    case 'games get': {
      if (!slug) fail('games get 需要 slug', 2);
      const data = await client.request('GET', `/api/games/${encodeURIComponent(slug)}`);
      return json(flags.json ? data : data.game);
    }
    case 'games create': {
      const { slug: newSlug, entity } = splitSlug(readBodyFile(flags.file));
      const data = await client.request('POST', '/api/games', { slug: newSlug, game: entity });
      return json(flags.json ? data : { ok: true, slug: newSlug });
    }
    case 'games update': {
      if (!slug) fail('games update 需要 slug', 2);
      const current = await client.request('GET', `/api/games/${encodeURIComponent(slug)}`);
      const { entity } = splitSlug(readBodyFile(flags.file));
      const merged = { ...current.game, ...entity };
      const data = await client.request('PUT', `/api/games/${encodeURIComponent(slug)}`, { game: merged });
      return json(flags.json ? data : { ok: true, slug, updated: Object.keys(entity) });
    }
    case 'games upsert': {
      const { slug: target, entity } = splitSlug(readBodyFile(flags.file));
      const existing = (await client.request('GET', `/api/games/${encodeURIComponent(target)}`, undefined, { allow404: true }))?.game ?? null;
      if (existing) {
        const merged = { ...existing, ...entity };
        const data = await client.request('PUT', `/api/games/${encodeURIComponent(target)}`, { game: merged });
        return json(flags.json ? data : { ok: true, slug: target, action: 'updated' });
      }
      const data = await client.request('POST', '/api/games', { slug: target, game: entity });
      return json(flags.json ? data : { ok: true, slug: target, action: 'created' });
    }
    case 'games delete': {
      if (!slug) fail('games delete 需要 slug', 2);
      const data = await client.request('DELETE', `/api/games/${encodeURIComponent(slug)}`);
      return json(flags.json ? data : { ok: true, deleted: slug });
    }

    case 'about get': {
      const data = await client.request('GET', '/api/about');
      return json(flags.json ? data : data.body);
    }
    case 'about update': {
      const raw = readBodyFile(flags.file);
      const body = typeof raw === 'string' ? raw : raw.body;
      if (typeof body !== 'string' || !body.trim()) fail('--file 里没有可用的正文（.md 文件或 {"body": "..."})', 2);
      const data = await client.request('PUT', '/api/about', { body });
      return json(flags.json ? data : { ok: true, updated: 'about' });
    }

    case 'export': {
      const [posts, games, about] = await Promise.all([
        client.request('GET', '/api/posts'),
        client.request('GET', '/api/games'),
        client.request('GET', '/api/about'),
      ]);
      const fullPosts = [];
      for (const post of posts.posts) {
        fullPosts.push((await client.request('GET', `/api/posts/${encodeURIComponent(post.slug)}`)).post);
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        posts: fullPosts,
        games: games.games,
        about: about.body,
      };
      if (flags.out) {
        writeFileSync(flags.out, JSON.stringify(payload, null, 2));
        console.log(`已导出到 ${flags.out}（${fullPosts.length} 篇文章、${games.games.length} 个游戏）`);
      } else {
        json(payload);
      }
      return;
    }

    default:
      fail(`未知命令: ${positional.join(' ')}\n\n${USAGE}`, 2);
  }
}

main().catch((error) => fail(error.message || String(error)));
