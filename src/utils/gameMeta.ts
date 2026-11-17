import type { Game } from '../lib/types';

export type GameSort = 'updated' | 'added' | 'release';

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

export function sortGames(games: Game[], sort: GameSort): Game[] {
  const sorted = [...games];
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

export function formatGameDate(date: string | undefined): string {
  return date || '—';
}
