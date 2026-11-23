-- 为已有数据库补充站点配置表（书架顺序 / 首页近期游戏）。
-- 本地：npx wrangler d1 execute hallowmuyi --local --file=db/site-settings.sql
-- 线上：npx wrangler d1 execute hallowmuyi --remote --file=db/site-settings.sql

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                 -- JSON
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
