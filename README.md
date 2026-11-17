# MUYI BLOG

> 一个像素游戏风的个人博客。写点代码，记点游戏，存一些还没想明白的问题。
>
> 🌐 **<https://hallowmuyi.space>**

---

## 关于这个站点

这是我自己的一块自留地。

做它的初衷很简单：不想被平台限制排版，也不想为了发一篇文章去折腾一堆工具。所以整站是像素游戏的样子——浅色主题像一张发黄的像素纸，深色主题像深夜还亮着的街机厅。打开首页先看到的是 PLAYER STATUS 和 MAIN MENU，文章列表叫「读取存档」，标签页叫「物品栏」。

技术上它是个 Astro 应用，跑在 Cloudflare 上。数据存在 D1（SQLite）里，所有页面在**请求时**才去读库，后台点保存后刷新页面就能看到，不用等构建，也不消耗部署次数。

## 这里能做什么

### 📖 文章

- 文章列表、详情页，详情页带字数、阅读时长、上一篇 / 下一篇
- 按年份归档，按标签聚合（标签页会显示每个标签下有几篇）
- RSS 订阅：`/rss.xml`
- 站内搜索：输入关键词，按标题 / 标签 / 描述 / 正文加权模糊匹配，边打字边出结果

### 🎮 游戏书架

把玩过的游戏做成卡片收藏，算是一个私人的游戏档案。

- 三种排序：最近更新 / 最近加入 / 发售日期
- 详情页：封面、开发商 / 发行商 / 平台 / 类型、媒体评分、官网、外链存档（文章和视频）
- 版本时间线：记录每个版本更新了什么
- 关联文章：游戏和博客互相引用
- 图片加载失败会自动隐藏，不会留下破图

### ✍️ 后台

`/admin` 一个页面搞定所有内容，一个密码进入：

- 文章：新建、编辑、删除、草稿
- 关于页：直接改
- 游戏：增删改，封面 URL 实时预览，评分 / 外链 / 时间线都是动态行

保存即生效。发布一篇文章、改一个标点、加一个游戏，都只是对数据库的读写，和部署没有关系。

### ✨ 一些小心思

- 像素字体只用在标题和 UI 上，正文用普通字体，读长文不费眼
- 深色 / 浅色主题跟随系统，也可以手动切换，选择记在本地
- 登录后导航栏出现「后台」，文章页出现「编辑这篇」，游戏页出现「编辑此游戏」
- Giscus 评论、Cloudflare Web Analytics、404 是「GAME OVER」画面

## 更新日志

只记大节点。

### 2026-11-17 · v1.0 数据层重构：内容住进数据库

- 站点从 Cloudflare Pages 迁到 **Workers**（适配器 v13 起已移除 Pages 支持）
- 内容从「GitHub 上的 Markdown 文件 + 提交触发重建」改为 **Cloudflare D1 数据库**
- 页面改为请求时读库，后台保存立即生效，再也不用等一两分钟的自动构建
- RSS、sitemap、搜索索引都改为运行时生成
- 新增 `scripts/deploy.mjs`，部署时自动绑定自定义域

### 2026-11-14 · v0.6 游戏书架

- 新增游戏卡片与详情页：评分、外链存档、版本时间线、关联文章
- 书架支持三种排序，排序状态写进 URL
- 后台加入游戏管理

### 2026-11-10 · v0.5 首页变成了游戏菜单

- 首页重做为标题画面：PLAYER STATUS（HP 和按写作量计算的 EXP）、MAIN MENU、QUEST LOG
- 顺手修了 SEO 和一批体验细节

### 2026-11-09 · v0.4 像素风改版

- 全站换成像素游戏风格：双主题、硬边框、扫描线、像素字体
- 裁剪像素字体子集，控制体积

### 2026-11-09 · v0.3 在线发文后台

- 新增 `/admin`，可以在浏览器里写文章、改关于页
- 登录后全站显示后台入口

### 2026-11-09 · v0.2 补上博客该有的东西

- RSS、sitemap、页面 SEO、Giscus 评论、访问统计

### 2026-11-09 · v0.1 起步

- 从 Astro 模板开始，搭出布局、文章列表、详情、归档、标签、关于这几页

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Astro 7（`output: 'server'`） |
| 部署 | `@astrojs/cloudflare` v14 + Wrangler 4，Cloudflare Workers 静态资源 |
| 数据库 | Cloudflare D1（SQLite） |
| 样式 | Tailwind CSS 4 + 自定义像素风组件类 |
| 正文渲染 | `marked` |
| 评论 | Giscus |

```
浏览器
  ├─ 静态资源（CSS / 字体 / 图片 / 后台页面）→ Worker Static Assets
  └─ 页面与接口 → Astro SSR（Worker 运行时）
                    └─ 读写数据 → Cloudflare D1
```

改内容不触发构建，是这个架构最想解决的问题。

## 本地跑起来

```bash
npm install

# 1. 初始化本地数据库（建表 + 导入种子内容）
npm run db:local:init
npm run db:local:seed

# 2. 本地后台密码
echo ADMIN_PASSWORD=你的密码 > .dev.vars

# 3. 启动
npm run dev -- --background
```

打开 <http://localhost:4321>，后台在 `/admin`。

管理后台进程用 `npm run astro -- dev status | logs | stop`。

构建和本地预览真实 Worker 产物：

```bash
npm run build
npm run preview
```

`preview` 会显式指定 `--persist-to .wrangler/state`，否则 Wrangler 会另开一个空库。

## 部署

首次部署：

```bash
npx wrangler login
npx wrangler d1 create hallowmuyi     # 把返回的 database_id 填进 wrangler.jsonc
npm run db:remote:init
npx wrangler secret put ADMIN_PASSWORD
npm run db:remote:seed                # 可选：导入仓库里的旧内容
npm run deploy
```

之后改代码只需要 `npm run deploy`。

不要直接跑 `wrangler deploy`：Astro 适配器构建时会重写 `dist/server/wrangler.json`，把项目根目录配置里的 `routes` 丢掉。`scripts/deploy.mjs` 会把自定义域和 `workers_dev` 补回去再部署，改域名只需要改这个脚本里的 `ROUTES`。

`hallowmuyi.space` 和 `www.hallowmuyi.space` 都已经在脚本里声明，每次部署自动绑定。Worker 默认地址 `https://hallowmuyi-blog.songmy1017.workers.dev` 也保留着，方便验证。

> 如果域名刚从别的项目挪过来，本地可能因为 DNS 负缓存暂时解析不到（`ENOTFOUND`），公网是正常的。可以用 `nslookup hallowmuyi.space 1.1.1.1` 确认，或等最多半小时。

## 接口

都在 `src/pages/api/`，除登录 / 会话外都需要管理员 cookie（`hm_admin`，HMAC 签名，7 天有效）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/login` | 密码登录 |
| `GET` | `/api/session` | 当前登录状态 |
| `POST` | `/api/logout` | 退出 |
| `GET` / `POST` | `/api/posts` | 文章列表 / 新建 |
| `GET` / `PUT` / `DELETE` | `/api/posts/<slug>` | 单篇读取 / 更新 / 删除 |
| `GET` / `POST` | `/api/games` | 游戏列表 / 新建 |
| `GET` / `PUT` / `DELETE` | `/api/games/<slug>` | 单个游戏读取 / 更新 / 删除 |
| `GET` / `PUT` | `/api/about` | 关于页读取 / 更新 |

另有 `/rss.xml`、`/sitemap.xml`、`/search-index.json` 三个运行时生成的资源。

## 数据存在哪

三张表，数组和对象字段以 JSON 字符串存储：

- `posts`：slug、标题、日期、描述、标签、草稿、正文
- `games`：slug、标题、原名、封面、简介、厂商、发售日、平台、类型、官网、评分、外链、时间线、关联文章、草稿
- `pages`：固定页面（目前只有「关于」）

建表语句在 [db/schema.sql](db/schema.sql)。`src/content/` 只是迁移前的种子数据，日常写作请走 `/admin`——直接改那里的文件不会再影响站点。

## 关于费用

跑在免费额度内：

- **Workers**：10 万请求 / 天，10ms CPU / 请求
- **D1**：500 万行读 / 天，10 万行写 / 天，5GB 存储

页面是 SSR，`/search-index.json` 和 `/sitemap.xml` 带了 `s-maxage=300`，其余页面不缓存——保证发文章后立即可见。访问量涨上来可以再加 Cache Rules 做边缘缓存。

## 已知限制

- 正文用 `marked` 渲染，没有代码语法高亮（原来是 Astro 内置的 Shiki）；想要的话可以在 `src/lib/markdown.ts` 里接回 shiki
- `/admin` 是预渲染的静态页，只负责前端表单，真正的权限校验在接口层
- 搜索索引每次请求都读全表，文章很多时可以考虑缓存或改全文索引
