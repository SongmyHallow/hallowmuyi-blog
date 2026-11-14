import type { CollectionEntry } from 'astro:content';

export type GameSort = 'updated' | 'added' | 'release';
export type GameEntry = CollectionEntry<'games'>;

// timeline 中日期最新的一条
function latestTimeline(game: GameEntry): GameEntry['data']['timeline'][number] | undefined {
  return game.data.timeline.reduce<GameEntry['data']['timeline'][number] | undefined>(
    (latest, item) => (!latest || item.date > latest.date ? item : latest),
    undefined,
  );
}

export function latestTimelineDate(game: GameEntry): Date | undefined {
  return latestTimeline(game)?.date;
}

// 取 timeline 中日期最新一条的版本号
export function latestVersion(game: GameEntry): string | undefined {
  return latestTimeline(game)?.version;
}

// 最近更新时间：max(updatedAt, timeline 最新日期, addedAt)
export function lastUpdatedAt(game: GameEntry): number {
  const times = [game.data.addedAt.getTime()];
  if (game.data.updatedAt) times.push(game.data.updatedAt.getTime());
  const timelineDate = latestTimelineDate(game);
  if (timelineDate) times.push(timelineDate.getTime());
  return Math.max(...times);
}

// 同值时按标题排序，保证顺序稳定
function byTitle(a: GameEntry, b: GameEntry): number {
  return a.data.title.localeCompare(b.data.title, 'zh-CN');
}

export function sortGames(games: GameEntry[], sort: GameSort): GameEntry[] {
  const sorted = [...games];
  if (sort === 'release') {
    return sorted.sort((a, b) => {
      const ta = a.data.releaseDate?.getTime();
      const tb = b.data.releaseDate?.getTime();
      if (ta === undefined && tb === undefined) return byTitle(a, b);
      if (ta === undefined) return 1; // 没有发售日期排最后
      if (tb === undefined) return -1;
      return tb !== ta ? tb - ta : byTitle(a, b);
    });
  }
  const keyOf = sort === 'added' ? (g: GameEntry) => g.data.addedAt.getTime() : lastUpdatedAt;
  return sorted.sort((a, b) => {
    const diff = keyOf(b) - keyOf(a);
    return diff !== 0 ? diff : byTitle(a, b);
  });
}

export function formatGameDate(date: Date | undefined): string {
  return date ? date.toISOString().slice(0, 10) : '—';
}
