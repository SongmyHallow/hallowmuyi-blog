import { env } from 'cloudflare:workers';
import type { Comment, CommentStatus, Game, Page, Post } from './types';

/**
 * 所有内容读写都走 Cloudflare D1。页面在请求时读库，后台保存后立即生效，
 * 不需要重新构建整个站点。
 *
 * 每条记录都带一个 `updated_at` / `row_updated_at` 版本串（毫秒精度的 ISO 时间），
 * 接口把它作为乐观锁的版本号返回，客户端修改时用 If-Match 回传。
 */

const db = () => env.DB;

/** 毫秒精度，作为乐观锁版本号；比 datetime('now') 的秒级更不容易撞车。 */
const VERSION_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export type SaveOutcome = 'ok' | 'missing' | 'conflict';

export interface PostRecord {
  post: Post;
  version: string;
}

export interface GameRecord {
  game: Game;
  version: string;
}

export interface PageRecord {
  page: Page;
  version: string;
}

interface PostRow {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string;
  draft: number;
  body: string;
  updated_at?: string;
}

interface GameRow {
  slug: string;
  title: string;
  original_title: string | null;
  cover: string;
  summary: string | null;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  added_at: string;
  updated_at: string | null;
  platforms: string;
  genres: string;
  official_url: string | null;
  scores: string;
  related_posts: string;
  links: string;
  timeline: string;
  draft: number;
  row_updated_at?: string;
}

interface PageRow {
  slug: string;
  title: string;
  body: string;
  updated_at?: string;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function rowToPost(row: PostRow): Post {
  return {
    slug: row.slug,
    title: row.title,
    date: row.date,
    description: row.description ?? '',
    tags: parseJson<string[]>(row.tags, []),
    draft: row.draft === 1,
    body: row.body ?? '',
  };
}

function rowToGame(row: GameRow): Game {
  return {
    slug: row.slug,
    title: row.title,
    originalTitle: row.original_title ?? undefined,
    cover: row.cover,
    summary: row.summary ?? undefined,
    developer: row.developer ?? undefined,
    publisher: row.publisher ?? undefined,
    releaseDate: row.release_date ?? undefined,
    addedAt: row.added_at,
    updatedAt: row.updated_at ?? undefined,
    platforms: parseJson<string[]>(row.platforms, []),
    genres: parseJson<string[]>(row.genres, []),
    officialUrl: row.official_url ?? undefined,
    scores: parseJson(row.scores, []),
    relatedPosts: parseJson<string[]>(row.related_posts, []),
    links: parseJson(row.links, []),
    timeline: parseJson(row.timeline, []),
    draft: row.draft === 1,
  };
}

function rowToPage(row: PageRow): Page {
  return { slug: row.slug, title: row.title, body: row.body ?? '' };
}

/* ------------------------------- 文章 ------------------------------- */

const POST_COLUMNS = 'slug, title, date, description, tags, draft, body, updated_at';

/** 关键词过滤：标题 / 描述 / 标签 / 正文，LIKE 对中文等价于包含匹配。 */
function postSearchClause(q: string | undefined, draftClause: string): { sql: string; binds: string[] } {
  const binds: string[] = [];
  const clauses: string[] = [];
  if (draftClause) clauses.push(draftClause);
  const keyword = q?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    clauses.push('(title LIKE ?1 OR description LIKE ?1 OR tags LIKE ?1 OR body LIKE ?1)');
    binds.push(like);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', binds };
}

export async function listPosts(options: { includeDrafts?: boolean } = {}): Promise<Post[]> {
  const where = postSearchClause(undefined, options.includeDrafts ? '' : 'draft = 0');
  const sql = `SELECT ${POST_COLUMNS} FROM posts${where.sql} ORDER BY date DESC, slug ASC`;
  const { results } = await db().prepare(sql).all<PostRow>();
  return (results ?? []).map(rowToPost);
}

/** 带版本号的文章列表，供管理接口使用。 */
export async function listPostRecords(
  options: { includeDrafts?: boolean; q?: string } = {}
): Promise<PostRecord[]> {
  const where = postSearchClause(options.q, options.includeDrafts ? '' : 'draft = 0');
  const sql = `SELECT ${POST_COLUMNS} FROM posts${where.sql} ORDER BY date DESC, slug ASC`;
  const statement = db().prepare(sql);
  const { results } = await (where.binds.length ? statement.bind(...where.binds) : statement).all<PostRow>();
  return (results ?? []).map((row) => ({
    post: rowToPost(row),
    version: row.updated_at ?? '',
  }));
}

export async function getPost(slug: string): Promise<Post | null> {
  const row = await db()
    .prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE slug = ?1`)
    .bind(slug)
    .first<PostRow>();
  return row ? rowToPost(row) : null;
}

export async function getPostRecord(slug: string): Promise<PostRecord | null> {
  const row = await db()
    .prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE slug = ?1`)
    .bind(slug)
    .first<PostRow>();
  return row ? { post: rowToPost(row), version: row.updated_at ?? '' } : null;
}

/** 按「日期倒序、slug 正序」的列表顺序，取当前文章的上一篇（更新）与下一篇（更早）。 */
export async function getNeighborPosts(
  slug: string,
  date: string
): Promise<{ newer: Post | null; older: Post | null }> {
  const [newerRow, olderRow] = await Promise.all([
    db()
      .prepare(
        `SELECT ${POST_COLUMNS} FROM posts
         WHERE draft = 0 AND (date > ?1 OR (date = ?1 AND slug < ?2))
         ORDER BY date ASC, slug DESC LIMIT 1`
      )
      .bind(date, slug)
      .first<PostRow>(),
    db()
      .prepare(
        `SELECT ${POST_COLUMNS} FROM posts
         WHERE draft = 0 AND (date < ?1 OR (date = ?1 AND slug > ?2))
         ORDER BY date DESC, slug ASC LIMIT 1`
      )
      .bind(date, slug)
      .first<PostRow>(),
  ]);
  return {
    newer: newerRow ? rowToPost(newerRow) : null,
    older: olderRow ? rowToPost(olderRow) : null,
  };
}

/** 写入文章，返回新的版本号。 */
export async function savePost(post: Post): Promise<string> {
  const row = await db()
    .prepare(
      `INSERT INTO posts (slug, title, date, description, tags, draft, body, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ${VERSION_SQL})
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         date = excluded.date,
         description = excluded.description,
         tags = excluded.tags,
         draft = excluded.draft,
         body = excluded.body,
         updated_at = excluded.updated_at
       RETURNING updated_at`
    )
    .bind(
      post.slug,
      post.title,
      post.date,
      post.description,
      JSON.stringify(post.tags),
      post.draft ? 1 : 0,
      post.body
    )
    .first<{ updated_at: string }>();
  return row?.updated_at ?? '';
}

/**
 * 删除文章。传了 expectedVersion 时只有当版本一致才删（乐观锁），
 * 返回 missing / conflict 便于接口给出准确的状态码。
 */
export async function deletePost(slug: string, expectedVersion?: string | null): Promise<SaveOutcome> {
  if (expectedVersion) {
    const result = await db()
      .prepare('DELETE FROM posts WHERE slug = ?1 AND updated_at = ?2')
      .bind(slug, expectedVersion)
      .run();
    if ((result.meta?.changes ?? 0) > 0) return 'ok';
    const row = await db()
      .prepare('SELECT updated_at FROM posts WHERE slug = ?1')
      .bind(slug)
      .first<{ updated_at: string }>();
    return row ? 'conflict' : 'missing';
  }
  const result = await db().prepare('DELETE FROM posts WHERE slug = ?1').bind(slug).run();
  return (result.meta?.changes ?? 0) > 0 ? 'ok' : 'missing';
}

/* ------------------------------- 游戏 ------------------------------- */

const GAME_COLUMNS =
  'slug, title, original_title, cover, summary, developer, publisher, release_date, added_at, updated_at, platforms, genres, official_url, scores, related_posts, links, timeline, draft, row_updated_at';

function gameSearchClause(q: string | undefined, draftClause: string): { sql: string; binds: string[] } {
  const binds: string[] = [];
  const clauses: string[] = [];
  if (draftClause) clauses.push(draftClause);
  const keyword = q?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    clauses.push(
      '(title LIKE ?1 OR original_title LIKE ?1 OR summary LIKE ?1 OR developer LIKE ?1 OR publisher LIKE ?1 OR genres LIKE ?1)'
    );
    binds.push(like);
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', binds };
}

export async function listGames(options: { includeDrafts?: boolean } = {}): Promise<Game[]> {
  const where = gameSearchClause(undefined, options.includeDrafts ? '' : 'draft = 0');
  const sql = `SELECT ${GAME_COLUMNS} FROM games${where.sql} ORDER BY added_at DESC, title ASC`;
  const { results } = await db().prepare(sql).all<GameRow>();
  return (results ?? []).map(rowToGame);
}

export async function listGameRecords(
  options: { includeDrafts?: boolean; q?: string } = {}
): Promise<GameRecord[]> {
  const where = gameSearchClause(options.q, options.includeDrafts ? '' : 'draft = 0');
  const sql = `SELECT ${GAME_COLUMNS} FROM games${where.sql} ORDER BY added_at DESC, title ASC`;
  const statement = db().prepare(sql);
  const { results } = await (where.binds.length ? statement.bind(...where.binds) : statement).all<GameRow>();
  return (results ?? []).map((row) => ({
    game: rowToGame(row),
    version: row.row_updated_at ?? '',
  }));
}

export async function getGame(slug: string): Promise<Game | null> {
  const row = await db()
    .prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE slug = ?1`)
    .bind(slug)
    .first<GameRow>();
  return row ? rowToGame(row) : null;
}

export async function getGameRecord(slug: string): Promise<GameRecord | null> {
  const row = await db()
    .prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE slug = ?1`)
    .bind(slug)
    .first<GameRow>();
  return row ? { game: rowToGame(row), version: row.row_updated_at ?? '' } : null;
}

/** 写入游戏，返回新的版本号。 */
export async function saveGame(game: Game): Promise<string> {
  const row = await db()
    .prepare(
      `INSERT INTO games (slug, title, original_title, cover, summary, developer, publisher,
         release_date, added_at, updated_at, platforms, genres, official_url, scores,
         related_posts, links, timeline, draft, row_updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ${VERSION_SQL})
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         original_title = excluded.original_title,
         cover = excluded.cover,
         summary = excluded.summary,
         developer = excluded.developer,
         publisher = excluded.publisher,
         release_date = excluded.release_date,
         added_at = excluded.added_at,
         updated_at = excluded.updated_at,
         platforms = excluded.platforms,
         genres = excluded.genres,
         official_url = excluded.official_url,
         scores = excluded.scores,
         related_posts = excluded.related_posts,
         links = excluded.links,
         timeline = excluded.timeline,
         draft = excluded.draft,
         row_updated_at = excluded.row_updated_at
       RETURNING row_updated_at`
    )
    .bind(
      game.slug,
      game.title,
      game.originalTitle ?? null,
      game.cover,
      game.summary ?? null,
      game.developer ?? null,
      game.publisher ?? null,
      game.releaseDate ?? null,
      game.addedAt,
      game.updatedAt ?? null,
      JSON.stringify(game.platforms),
      JSON.stringify(game.genres),
      game.officialUrl ?? null,
      JSON.stringify(game.scores),
      JSON.stringify(game.relatedPosts),
      JSON.stringify(game.links),
      JSON.stringify(game.timeline),
      game.draft ? 1 : 0
    )
    .first<{ row_updated_at: string }>();
  return row?.row_updated_at ?? '';
}

export async function deleteGame(slug: string, expectedVersion?: string | null): Promise<SaveOutcome> {
  if (expectedVersion) {
    const result = await db()
      .prepare('DELETE FROM games WHERE slug = ?1 AND row_updated_at = ?2')
      .bind(slug, expectedVersion)
      .run();
    if ((result.meta?.changes ?? 0) > 0) return 'ok';
    const row = await db()
      .prepare('SELECT row_updated_at FROM games WHERE slug = ?1')
      .bind(slug)
      .first<{ row_updated_at: string }>();
    return row ? 'conflict' : 'missing';
  }
  const result = await db().prepare('DELETE FROM games WHERE slug = ?1').bind(slug).run();
  return (result.meta?.changes ?? 0) > 0 ? 'ok' : 'missing';
}

/* ------------------------------- 单页 ------------------------------- */

export async function getPage(slug: string): Promise<Page | null> {
  const row = await db()
    .prepare('SELECT slug, title, body FROM pages WHERE slug = ?1')
    .bind(slug)
    .first<PageRow>();
  return row ? rowToPage(row) : null;
}

export async function getPageRecord(slug: string): Promise<PageRecord | null> {
  const row = await db()
    .prepare('SELECT slug, title, body, updated_at FROM pages WHERE slug = ?1')
    .bind(slug)
    .first<PageRow>();
  return row ? { page: rowToPage(row), version: row.updated_at ?? '' } : null;
}

/** 写入单页，返回新的版本号。 */
export async function savePage(page: Page): Promise<string> {
  const row = await db()
    .prepare(
      `INSERT INTO pages (slug, title, body, updated_at)
       VALUES (?1, ?2, ?3, ${VERSION_SQL})
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         updated_at = excluded.updated_at
       RETURNING updated_at`
    )
    .bind(page.slug, page.title, page.body)
    .first<{ updated_at: string }>();
  return row?.updated_at ?? '';
}

/* ------------------------------- 评论 ------------------------------- */

interface CommentRow {
  id: number;
  slug: string;
  nickname: string;
  email: string;
  body: string;
  status: string;
  created_at: string;
}

const COMMENT_COLUMNS = 'id, slug, nickname, email, body, status, created_at';

function rowToComment(row: CommentRow): Comment {
  const status = row.status === 'approved' || row.status === 'hidden' ? row.status : 'pending';
  return {
    id: row.id,
    slug: row.slug,
    nickname: row.nickname,
    email: row.email ?? '',
    body: row.body ?? '',
    status,
    createdAt: row.created_at,
  };
}

/** 文章页展示用：只返回已通过的评论，按时间正序。 */
export async function listApprovedComments(slug: string): Promise<Comment[]> {
  const { results } = await db()
    .prepare(
      `SELECT ${COMMENT_COLUMNS} FROM comments
       WHERE slug = ?1 AND status = 'approved'
       ORDER BY created_at ASC, id ASC`
    )
    .bind(slug)
    .all<CommentRow>();
  return (results ?? []).map(rowToComment);
}

/** 后台审核用：默认全部状态，按提交时间倒序。 */
export async function listComments(
  options: { status?: CommentStatus; limit?: number } = {}
): Promise<Comment[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  if (options.status) {
    const { results } = await db()
      .prepare(
        `SELECT ${COMMENT_COLUMNS} FROM comments
         WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2`
      )
      .bind(options.status, limit)
      .all<CommentRow>();
    return (results ?? []).map(rowToComment);
  }
  const { results } = await db()
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM comments ORDER BY created_at DESC, id DESC LIMIT ?1`)
    .bind(limit)
    .all<CommentRow>();
  return (results ?? []).map(rowToComment);
}

export async function getComment(id: number): Promise<Comment | null> {
  const row = await db()
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM comments WHERE id = ?1`)
    .bind(id)
    .first<CommentRow>();
  return row ? rowToComment(row) : null;
}

export async function createComment(input: {
  slug: string;
  nickname: string;
  email: string;
  body: string;
  ipHash: string;
}): Promise<number> {
  const row = await db()
    .prepare(
      `INSERT INTO comments (slug, nickname, email, body, status, ip_hash)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5)
       RETURNING id`
    )
    .bind(input.slug, input.nickname, input.email, input.body, input.ipHash)
    .first<{ id: number }>();
  return row?.id ?? 0;
}

export async function setCommentStatus(id: number, status: CommentStatus): Promise<boolean> {
  const result = await db()
    .prepare('UPDATE comments SET status = ?2 WHERE id = ?1')
    .bind(id, status)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function deleteComment(id: number): Promise<boolean> {
  const result = await db().prepare('DELETE FROM comments WHERE id = ?1').bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * 限流：同一 IP 在最近 N 分钟内提交了几条。
 * created_at 与 toISOString() 同为 `YYYY-MM-DDTHH:mm:ss.sssZ`，可直接按字符串比较。
 */
export async function countRecentComments(ipHash: string, minutes = 10): Promise<number> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const row = await db()
    .prepare('SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ?1 AND created_at >= ?2')
    .bind(ipHash, cutoff)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

