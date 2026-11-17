import type { Game, GameLink, GameScore, GameTimeline, Post } from './types';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {}

const fail = (message: string): never => {
  throw new ValidationError(message);
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 只接受字符串/数字，避免把对象转成 "[object Object]" */
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

/** 合法的 YYYY-MM-DD（同时排除 2024-02-31 这类溢出日期） */
export function validDate(value: unknown): string | undefined {
  const s = text(value);
  if (!s || !DATE_RE.test(s)) return undefined;
  const date = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s) return undefined;
  return s;
}

function normalizeDate(value: unknown, error: string): string | undefined {
  if (value === undefined || value === null || text(value) === '') return undefined;
  const date = validDate(value);
  if (!date) throw new ValidationError(error);
  return date;
}

/** 去空、去空白、去重 */
function uniqStrings(value: unknown): string[] {
  const out: string[] = [];
  for (const item of asArray(value)) {
    const s = text(item);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** 游戏「最近编辑日期」按北京时间取当天，避免 UTC 与本地日期错位 */
export function todayInShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function normalizePost(slug: string, input: unknown): Post {
  if (!SLUG_RE.test(slug)) fail('slug 只能包含小写字母、数字、连字符');
  const raw = asRecord(input);
  const title = text(raw.title);
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (!title || !body.trim()) fail('标题和正文必填');
  const date = normalizeDate(raw.date, '日期格式应为 YYYY-MM-DD') ?? todayInShanghai();
  return {
    slug,
    title,
    date,
    description: text(raw.description),
    tags: uniqStrings(raw.tags),
    draft: raw.draft === true || raw.draft === 'true',
    body,
  };
}

export function normalizeGame(slug: string, input: unknown): Game {
  if (!SLUG_RE.test(slug)) fail('slug 不合法');
  const raw = asRecord(input);

  const title = text(raw.title);
  if (!title) fail('标题必填');

  const cover = text(raw.cover);
  if (!cover || !isHttpUrl(cover)) fail('封面图 URL 不合法');

  const addedAt = normalizeDate(raw.addedAt, '加入书架日期不合法');
  if (!addedAt) fail('加入书架日期不合法');

  const officialUrl = optionalText(raw.officialUrl);
  if (officialUrl && !isHttpUrl(officialUrl)) fail('官网 URL 不合法');

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
    if (!isHttpUrl(url)) fail('链接 URL 不合法');
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

  const timeline: GameTimeline[] = [];
  for (const item of asArray(raw.timeline)) {
    const update = asRecord(item);
    const version = text(update.version);
    const summary = text(update.summary);
    const date = validDate(update.date);
    if (!version || !summary || !date) continue;
    const entry: GameTimeline = { version, date, summary };
    const url = optionalText(update.url);
    if (url) {
      if (!isHttpUrl(url)) fail('更新链接 URL 不合法');
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
    slug,
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

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
