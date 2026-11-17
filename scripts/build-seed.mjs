// 把 src/content 下的旧内容（Markdown / JSON）转换成 db/seed.sql。
// 内容现在以 D1 为准，这些文件只作为初始种子；之后都通过后台编辑。
//
//   node scripts/build-seed.mjs
//   npx wrangler d1 execute hallowmuyi --local --file=db/seed.sql
//   npx wrangler d1 execute hallowmuyi --remote --file=db/seed.sql

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src', 'content');

/** 只解析本项目用到的 frontmatter 子集：字符串、数组、布尔。 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^["']|["']$/g, ''));
    } else {
      value = value.replace(/^["']|["']$/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
    }
    data[key] = value;
  }
  return { data, body: match[2] };
}

const sqlString = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;
const sqlJson = (value) => sqlString(JSON.stringify(value ?? []));

async function listMarkdown(dir) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdown(full)));
    else if (extname(entry.name) === '.md') files.push(full);
  }
  return files;
}

const lines = ['-- 由 scripts/build-seed.mjs 生成，请勿手工编辑。'];

// 文章
for (const file of await listMarkdown(join(contentDir, 'blog'))) {
  const raw = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const slug = basename(file, '.md');
  lines.push(
    `INSERT OR REPLACE INTO posts (slug, title, date, description, tags, draft, body) VALUES (` +
      [sqlString(slug), sqlString(data.title ?? slug), sqlString(data.date ?? '1970-01-01'), sqlString(data.description ?? ''), sqlJson(data.tags ?? []), data.draft ? 1 : 0, sqlString(body.trim())].join(', ') +
      ');'
  );
}

// 单页
for (const file of await listMarkdown(join(contentDir, 'pages'))) {
  const raw = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const slug = basename(file, '.md');
  lines.push(
    `INSERT OR REPLACE INTO pages (slug, title, body) VALUES (` +
      [sqlString(slug), sqlString(data.title ?? slug), sqlString(body.trim())].join(', ') +
      ');'
  );
}

// 游戏
let gameFiles = [];
try {
  gameFiles = await readdir(join(contentDir, 'games'));
} catch {
  gameFiles = [];
}
for (const name of gameFiles) {
  if (extname(name) !== '.json') continue;
  const game = JSON.parse(await readFile(join(contentDir, 'games', name), 'utf8'));
  const slug = basename(name, '.json');
  lines.push(
    `INSERT OR REPLACE INTO games (slug, title, original_title, cover, summary, developer, publisher, release_date, added_at, updated_at, platforms, genres, official_url, scores, related_posts, links, timeline, draft) VALUES (` +
      [
        sqlString(slug),
        sqlString(game.title),
        sqlString(game.originalTitle),
        sqlString(game.cover),
        sqlString(game.summary),
        sqlString(game.developer),
        sqlString(game.publisher),
        sqlString(game.releaseDate),
        sqlString(game.addedAt),
        sqlString(game.updatedAt),
        sqlJson(game.platforms),
        sqlJson(game.genres),
        sqlString(game.officialUrl),
        sqlJson(game.scores),
        sqlJson(game.relatedPosts),
        sqlJson(game.links),
        sqlJson(game.timeline),
        game.draft ? 1 : 0,
      ].join(', ') +
      ');'
  );
}

await mkdir(join(root, 'db'), { recursive: true });
const out = join(root, 'db', 'seed.sql');
await writeFile(out, lines.join('\n') + '\n', 'utf8');
console.log(`已生成 ${out}（${lines.length - 1} 条记录）`);
