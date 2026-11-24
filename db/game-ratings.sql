-- 给游戏增加「我的评分」与「我的评价」。
-- 已有数据库执行一次即可；全新初始化直接跑 db/schema.sql 就包含这两列。
--   本地：npx wrangler d1 execute hallowmuyi --local --file=db/game-ratings.sql
--   线上：npx wrangler d1 execute hallowmuyi --remote --file=db/game-ratings.sql

ALTER TABLE games ADD COLUMN rating REAL;
ALTER TABLE games ADD COLUMN my_review TEXT;
