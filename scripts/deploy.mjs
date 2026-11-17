// 部署脚本：把自定义域注入 Astro 生成的 wrangler 配置，然后交给 wrangler 部署。
//
// 为什么需要这一步：@astrojs/cloudflare 在构建时会自己生成
// dist/server/wrangler.json，并且不会保留项目根目录 wrangler.jsonc 里的
// `routes`，所以 `wrangler deploy` 直接跑会丢掉自定义域。这里在构建产物上
// 补回 routes（以及 workers_dev，保留 xxx.workers.dev 便于调试）。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONFIG_PATH = fileURLToPath(new URL('../dist/server/wrangler.json', import.meta.url));

const ROUTES = [
  { pattern: 'hallowmuyi.space', custom_domain: true },
  { pattern: 'www.hallowmuyi.space', custom_domain: true },
];

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
config.routes = ROUTES;
config.workers_dev = true;
config.preview_urls = false;
writeFileSync(CONFIG_PATH, JSON.stringify(config));

// 直接调用 wrangler 的 JS 入口：Windows 上 npx 是 .cmd，execFileSync 需要 shell，
// 而 shell: true 会把参数拼成字符串（有注入风险且会触发 Node 告警）。
const wranglerBin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
execFileSync(process.execPath, [wranglerBin, 'deploy', '--config', CONFIG_PATH], { stdio: 'inherit' });
