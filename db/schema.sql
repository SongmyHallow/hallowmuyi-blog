-- hallowmuyi.space 的内容数据库（Cloudflare D1 / SQLite）
-- 应用方式：
--   本地：npx wrangler d1 execute hallowmuyi --local --file=db/schema.sql
--   线上：npx wrangler d1 execute hallowmuyi --remote --file=db/schema.sql

CREATE TABLE IF NOT EXISTS posts (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,              -- YYYY-MM-DD
  description TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON 数组
  draft       INTEGER NOT NULL DEFAULT 0,
  body        TEXT NOT NULL DEFAULT '',    -- Markdown 原文
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts (date DESC);

CREATE TABLE IF NOT EXISTS games (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  original_title TEXT,
  cover         TEXT NOT NULL,             -- 封面图 URL
  summary       TEXT,
  developer     TEXT,
  publisher     TEXT,
  release_date  TEXT,                      -- YYYY-MM-DD
  added_at      TEXT NOT NULL,             -- YYYY-MM-DD
  updated_at    TEXT,                      -- YYYY-MM-DD，由服务端写入
  platforms     TEXT NOT NULL DEFAULT '[]',
  genres        TEXT NOT NULL DEFAULT '[]',
  official_url  TEXT,
  scores        TEXT NOT NULL DEFAULT '[]', -- [{source, score}]
  related_posts TEXT NOT NULL DEFAULT '[]',
  links         TEXT NOT NULL DEFAULT '[]', -- [{title, url, type, note, date}]
  timeline      TEXT NOT NULL DEFAULT '[]', -- [{version, date, summary, url}]
  draft         INTEGER NOT NULL DEFAULT 0,
  row_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 自建评论：访客无需登录，昵称 + 可选邮箱；先审后发。
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL,                 -- 对应 posts.slug
  nickname   TEXT NOT NULL,
  email      TEXT NOT NULL DEFAULT '',      -- 仅站长可见，不公开显示
  body       TEXT NOT NULL,                 -- 纯文本
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | hidden
  ip_hash    TEXT NOT NULL DEFAULT '',      -- 提交者 IP 的哈希，仅用于限流
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_status ON comments (slug, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip_hash, created_at);
