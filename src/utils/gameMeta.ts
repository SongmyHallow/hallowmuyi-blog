import type { Game } from '../lib/types';

export type GameSort = 'shelf' | 'rating-desc' | 'rating-asc' | 'updated' | 'added' | 'release';

function toTime(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? undefined : time;
}

// timeline 中日期最新的一条
function latestTimeline(game: Game): Game['timeline'][number] | undefined {
  return game.timeline.reduce<Game['timeline'][number] | undefined>(
    (latest, item) => (!latest || item.date > latest.date ? item : latest),
    undefined
  );
}

export function latestTimelineDate(game: Game): string | undefined {
  return latestTimeline(game)?.date;
}

// 取 timeline 中日期最新一条的版本号
export function latestVersion(game: Game): string | undefined {
  return latestTimeline(game)?.version;
}

// 最近更新时间：max(updatedAt, timeline 最新日期, addedAt)
export function lastUpdatedAt(game: Game): number {
  const times = [toTime(game.addedAt) ?? 0];
  const updated = toTime(game.updatedAt);
  if (updated !== undefined) times.push(updated);
  const timelineDate = latestTimelineDate(game);
  const timelineTime = toTime(timelineDate);
  if (timelineTime !== undefined) times.push(timelineTime);
  return Math.max(...times);
}

export function addedAtTime(game: Game): number {
  return toTime(game.addedAt) ?? 0;
}

export function releaseTime(game: Game): number | undefined {
  return toTime(game.releaseDate);
}

// 同值时按标题排序，保证顺序稳定
function byTitle(a: Game, b: Game): number {
  return a.title.localeCompare(b.title, 'zh-CN');
}

export function sortGames(games: Game[], sort: GameSort, shelfOrder: string[] = []): Game[] {
  const sorted = [...games];
  if (sort === 'shelf') {
    const rank = new Map(shelfOrder.map((slug, index) => [slug, index]));
    const listed: Game[] = [];
    const unlisted: Game[] = [];
    for (const game of sorted) {
      if (rank.has(game.slug)) listed.push(game);
      else unlisted.push(game);
    }
    listed.sort((a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0));
    unlisted.sort((a, b) => {
      const diff = lastUpdatedAt(b) - lastUpdatedAt(a);
      return diff !== 0 ? diff : byTitle(a, b);
    });
    return [...listed, ...unlisted];
  }
  if (sort === 'rating-desc' || sort === 'rating-asc') {
    const rank = new Map(shelfOrder.map((slug, index) => [slug, index]));
    const direction = sort === 'rating-desc' ? -1 : 1;
    const byShelf = (a: Game, b: Game): number => {
      const ra = rank.get(a.slug);
      const rb = rank.get(b.slug);
      if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
      if (ra !== undefined && rb === undefined) return -1;
      if (ra === undefined && rb !== undefined) return 1;
      return byTitle(a, b);
    };
    return sorted.sort((a, b) => {
      const ra = a.rating;
      const rb = b.rating;
      if (ra === undefined && rb === undefined) return byShelf(a, b);
      if (ra === undefined) return 1; // 未评分排最后
      if (rb === undefined) return -1;
      if (ra !== rb) return (ra - rb) * direction;
      return byShelf(a, b);
    });
  }
  if (sort === 'release') {
    return sorted.sort((a, b) => {
      const ta = releaseTime(a);
      const tb = releaseTime(b);
      if (ta === undefined && tb === undefined) return byTitle(a, b);
      if (ta === undefined) return 1; // 没有发售日期排最后
      if (tb === undefined) return -1;
      return tb !== ta ? tb - ta : byTitle(a, b);
    });
  }
  const keyOf = sort === 'added' ? addedAtTime : lastUpdatedAt;
  return sorted.sort((a, b) => {
    const diff = keyOf(b) - keyOf(a);
    return diff !== 0 ? diff : byTitle(a, b);
  });
}

/**
 * 首页「近期游戏」：优先按后台精选顺序取（最多 limit 个）；
 * 没有有效精选时回退到最近更新前 limit 个。
 */
export function selectRecentGames(games: Game[], featured: string[] = [], limit = 4): Game[] {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  const picked: Game[] = [];
  for (const slug of featured) {
    const game = bySlug.get(slug);
    if (!game || game.draft || picked.includes(game)) continue;
    picked.push(game);
    if (picked.length >= limit) break;
  }
  if (picked.length > 0) return picked;
  return sortGames(games.filter((game) => !game.draft), 'updated').slice(0, limit);
}

export function formatGameDate(date: string | undefined): string {
  return date || '—';
}
