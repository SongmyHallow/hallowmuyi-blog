import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import { DATE_RE, SLUG_RE } from '../../lib/validate';

/**
 * 机器可读的接口说明，给脚本 / agent 自举用。
 * 公开访问即可，内容不含任何密钥。
 */
const schema = {
  version: 2,
  auth: {
    browser: 'cookie hm_admin（POST /api/login {password}）',
    script: 'Authorization: Bearer <API_TOKEN>',
    note: '所有资源接口都需要认证，/api/schema 与 /api/session 除外',
  },
  conventions: {
    version:
      'GET 返回的 version 是乐观锁版本号；PUT / PATCH / DELETE 时用 If-Match 回传，不匹配返回 409，记录不存在返回 412',
    ifMatch: 'If-Match: <version>（可加引号）；不传则强制覆盖',
    dryRun: '?dryRun=1 或 X-Dry-Run: 1：只校验不落库，返回 ok:true, dryRun:true',
    search: '列表接口支持 ?q= 关键词（标题、描述、标签、正文 / 游戏简介、厂商、类型）',
    full: 'GET /api/posts?full=1 返回完整文章（默认只返回 name/slug/title/version）',
    errors: '错误统一为 { error, code? }；校验失败 400，未登录 401，不存在 404，版本冲突 409',
  },
  constraints: {
    slug: {
      pattern: SLUG_RE.source,
      note: '小写字母、数字、连字符，不能以连字符开头',
    },
    date: {
      pattern: DATE_RE.source,
      note: 'YYYY-MM-DD；会拒绝 2024-02-31 这类溢出日期',
    },
    url: { note: '只接受 http / https 绝对地址' },
  },
  resources: {
    posts: {
      list: 'GET /api/posts（?q= &full=1）',
      item: 'GET /api/posts/{slug}',
      create: 'POST /api/posts { slug, post }',
      replace: 'PUT /api/posts/{slug} { post }',
      patch: 'PATCH /api/posts/{slug} { title?, date?, description?, tags?, draft?, body? }',
      delete: 'DELETE /api/posts/{slug}',
      fields: {
        slug: { type: 'string', required: true, pattern: SLUG_RE.source },
        title: { type: 'string', required: true },
        date: { type: 'string', required: false, default: '今天（北京时间）', pattern: DATE_RE.source },
        description: { type: 'string', required: false },
        tags: { type: 'string[]', required: false, default: [] },
        draft: { type: 'boolean', required: false, default: false },
        body: { type: 'string', required: true, note: 'Markdown 正文' },
      },
      response: { item: '{ post, version }', list: '{ posts: [{ name, slug, title, version }] }' },
    },
    games: {
      list: 'GET /api/games（?q=）',
      item: 'GET /api/games/{slug}',
      create: 'POST /api/games { slug, game }',
      replace: 'PUT /api/games/{slug} { game }',
      patch: 'PATCH /api/games/{slug} { ...部分字段 }',
      delete: 'DELETE /api/games/{slug}',
      fields: {
        slug: { type: 'string', required: true, pattern: SLUG_RE.source },
        title: { type: 'string', required: true },
        originalTitle: { type: 'string', required: false },
        cover: { type: 'string', required: true, note: '封面图绝对 URL' },
        summary: { type: 'string', required: false },
        developer: { type: 'string', required: false },
        publisher: { type: 'string', required: false },
        releaseDate: { type: 'string', required: false, pattern: DATE_RE.source },
        addedAt: { type: 'string', required: true, pattern: DATE_RE.source, note: '加入书架日期' },
        updatedAt: { type: 'string', required: false, note: '由服务端写入，忽略客户端传值' },
        platforms: { type: 'string[]', required: false },
        genres: { type: 'string[]', required: false },
        officialUrl: { type: 'string', required: false },
        scores: { type: '{ source: string, score: string }[]', required: false },
        relatedPosts: { type: 'string[]', required: false, note: '文章 slug' },
        links: {
          type: '{ title, url, type?: "article"|"video", note?, date? }[]',
          required: false,
        },
        timeline: {
          type: '{ version, date, summary, url? }[]',
          required: false,
          note: '版本更新记录，按日期倒序展示',
        },
        draft: { type: 'boolean', required: false, default: false },
      },
      response: { item: '{ game, version }', list: '{ games: [{ ...game, version }] }' },
    },
    gameLayout: {
      get: 'GET /api/game-layout',
      replace: 'PUT /api/game-layout { shelf, featured }',
      fields: {
        shelf: { type: 'string[]', required: true, note: '游戏 slug 的书架默认顺序；未列出的游戏排在后面' },
        featured: {
          type: 'string[]',
          required: true,
          note: '首页「近期游戏」的 slug，最多 4 个，必须来自 shelf 且不能是草稿；为空时首页回退到最近更新前 4 个',
        },
      },
      response: { item: '{ layout: { shelf, featured }, version }' },
    },
    about: {
      get: 'GET /api/about',
      replace: 'PUT /api/about { body }',
      patch: 'PATCH /api/about { body }',
      fields: { body: { type: 'string', required: true, note: 'Markdown 正文' } },
      response: { item: '{ body, title, version }' },
    },
  },
  cli: 'npm run content -- <resource> <action> [slug] [--file <json>] [--json] [--dry-run] [--if-match <version>]',
};

export const GET: APIRoute = async () =>
  json(schema, { headers: { 'Cache-Control': 'public, max-age=300' } });
