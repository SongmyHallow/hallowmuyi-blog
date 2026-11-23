// 站点内容的数据模型。数据库里数组/对象字段以 JSON 文本存储，
// 这里定义的是「读出并解析后」的形状，页面和 API 都用它。

export interface Post {
  slug: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  tags: string[];
  draft: boolean;
  /** Markdown 原文 */
  body: string;
}

export interface Page {
  slug: string;
  title: string;
  /** Markdown 原文 */
  body: string;
}

export interface GameScore {
  source: string;
  score: string;
}

export interface GameLink {
  title: string;
  url: string;
  type: 'article' | 'video';
  note?: string;
  /** YYYY-MM-DD */
  date?: string;
}

export interface GameTimeline {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
  url?: string;
}

export type CommentStatus = 'pending' | 'approved' | 'hidden';

export interface Comment {
  id: number;
  /** 文章 slug */
  slug: string;
  nickname: string;
  email: string;
  /** 纯文本，展示时需要转义 */
  body: string;
  status: CommentStatus;
  /** ISO 时间（UTC） */
  createdAt: string;
}

/** 站点级的书架布局：默认顺序 + 首页「近期游戏」精选。 */
export interface GameLayout {
  /** 书架默认顺序的 slug 列表；未列出的游戏排在后面。 */
  shelf: string[];
  /** 首页「近期游戏」的 slug 列表；为空时回退到最近更新前 4 个。 */
  featured: string[];
}

export interface Game {
  slug: string;
  title: string;
  originalTitle?: string;
  cover: string;
  summary?: string;
  developer?: string;
  publisher?: string;
  /** YYYY-MM-DD */
  releaseDate?: string;
  /** YYYY-MM-DD */
  addedAt: string;
  /** YYYY-MM-DD，由服务端写入 */
  updatedAt?: string;
  platforms: string[];
  genres: string[];
  officialUrl?: string;
  scores: GameScore[];
  relatedPosts: string[];
  links: GameLink[];
  timeline: GameTimeline[];
  draft: boolean;
}
