# MUYI BLOG

> 一个像素游戏风的个人博客。写点代码，记点游戏，存一些还没想明白的问题。
>
> 🌐 **<https://hallowmuyi.space>**

---

## 关于这个站点

这是我自己的一块自留地。

做它的初衷很简单：不想被平台限制排版，也不想为了发一篇文章去折腾一堆工具。所以整站是像素游戏的样子——浅色主题像一张发黄的像素纸，深色主题像深夜还亮着的街机厅。打开首页先看到的是 PLAYER STATUS 和 MAIN MENU，文章列表叫「读取存档」，标签页叫「物品栏」。

技术上它是个 Astro 应用，跑在 Cloudflare 上。数据存在 D1（SQLite）里，所有页面在**请求时**才去读库，后台点保存后刷新页面就能看到，不用等构建，也不消耗部署次数。

渲染出来的 HTML 会在边缘缓存 60 秒，鼠标悬停站内链接时浏览器就先预取下一页——所以第二次点开大多是秒开的。管理员登录状态下自动绕过缓存，改完立刻可见。

## 这里能做什么

### 📖 文章

- 首页就是文章流：左边是个人资料、标签筛选和「近期游戏」，右边是全部文章的整行列表
- 勾选标签即时筛选右侧文章，可以多选，筛选条件会写进地址栏，刷新和分享都能还原
- 文章列表、详情页，详情页带字数、阅读时长、目录、上一篇 / 下一篇
- 按年份归档，按标签聚合（标签页会显示每个标签下有几篇）
- RSS 订阅：`/rss.xml`
- 站内搜索：输入关键词，按标题 / 标签 / 描述 / 正文加权模糊匹配，边打字边出结果

### 🎮 游戏书架

把玩过的游戏做成卡片收藏，算是一个私人的游戏档案。

- 六种排序：默认 / 评分 ↓ / 评分 ↑ / 最近更新 / 最近加入 / 发售日期；「默认」即后台拖动调整的书架顺序，未评分的游戏始终排在评分排序末尾
- 左侧筛选：平台 / 类型多选，同一维度内取并集、不同维度间取交集，筛选状态同步到 `?platform=` 与 `?genre=`
- 首页「近期游戏」可以在后台勾选，最多 4 个；不选时自动回退到最近更新的 4 个
- 详情页：封面、我的评分、我的评价、开发商 / 发行商 / 平台 / 类型、媒体评分、官网、外链存档（文章和视频）
- 版本时间线：记录每个版本更新了什么
- 关联文章：游戏和博客互相引用
- 图片加载失败会自动隐藏，不会留下破图

### ✍️ 后台

`/admin` 一个页面搞定所有内容，一个密码进入：

- 文章：新建、编辑、删除、草稿
- 关于页：直接改
- 游戏：增删改，封面 URL 实时预览，我的评分 / 我的评价可直接编辑，媒体评分 / 外链 / 时间线都是动态行；可拖动调整书架顺序，并勾选首页「近期游戏」

保存即生效。发布一篇文章、改一个标点、加一个游戏，都只是对数据库的读写，和部署没有关系。

### ✨ 一些小心思

- 像素字体只用在标题和 UI 上，正文用普通字体，读长文不费眼
- 深色 / 浅色主题跟随系统，也可以手动切换，选择记在本地
- 登录后导航栏出现「后台」，文章页出现「编辑这篇」，游戏页出现「编辑此游戏」
- 自建评论（无需登录、先审后发）、Cloudflare Web Analytics、404 是「GAME OVER」画面

## 更新日志

只记大节点。

### 2026-11-24 · v1.8 游戏评分与个人短评

- 每个游戏新增「我的评分」：0.0–10.0、最小单位 0.1，后台可编辑，显示在封面左上角角标
- 详情页新增「我的评价」模块，展示自己写的短评；没有评价时不渲染
- 书架排序新增「评分 ↓ / 评分 ↑」；未评分游戏始终排在最后，同分按「默认」顺序
- 原「书架顺序」按钮更名为「默认」，后台拖动顺序仍然生效
- 评分与评价都是可选项，没填的游戏不显示角标和评价模块

### 2026-11-23 · v1.7 书架顺序与首页近期游戏可编辑

- 后台新增「书架顺序 / 首页近期游戏」面板：拖动或 ↑ ↓ 调整默认顺序，勾选首页展示的游戏（最多 4 个）
- 书架默认排序改为「书架顺序」，新游戏自动排在末尾；未配置时回退到最近更新
- 顺序与首页精选保存在 `site_settings`，保存后立即生效

### 2026-11-23 · v1.6 游戏书架筛选与条目补充

- 书架左侧新增平台 / 类型复选筛选：同维度多选取并集，平台与类型之间取交集
- 筛选状态同步到 URL，可与 `sort` 排序参数共存；移动端筛选面板可折叠
- 书架补充 DOTA2、命运2、永劫无间（端游）、异度之刃2、炉石传说、碧蓝航线，并更新王者万象棋条目

### 2026-11-23 · v1.5 首页改版：文章流 + 标签筛选

- 去掉标题画面和「主菜单」，首页直接进内容
- 角色状态卡换成常规个人卡：像素头像 + 名字 + 文章 / 游戏 / 标签计数，固定在左上
- 左栏标签可多选，勾选即时筛选右侧文章列表；筛选状态同步到 `?tags=`
- 左栏新增「近期游戏」，展示游戏书架里最近更新的 4 个封面，点开直达详情
- 顶栏去掉「标签」入口（改由首页标签筛选承担），关于页去掉「本站」模块

### 2026-11-18 · v1.4 字体与封面瘦身

- 像素字体拆成两面子集：常用字 `core`（109KB）+ 生僻字 `ext`（86KB），靠 `unicode-range` 按需下载，普通页面不再拉 176KB
- 字体文件改成一年期 `immutable` 缓存，回访不再重复验证
- 游戏封面补了宽高和加载优先级：列表页懒加载、详情页高优先级，减少布局跳动

### 2026-11-18 · v1.3 桌面端速度优化

- 页面 HTML 加边缘缓存（Workers Cache API，60 秒），命中时不再进数据库
- 悬停 / 空闲时预取站内页面，正文页、列表页跳转接近瞬时
- 像素字体加 `preload`，首屏少等一次字体请求
- 管理员登录状态自动绕过缓存，保存后依旧立刻生效

### 2026-11-17 · v1.2 自建评论系统

- 评论从 Giscus 换成自建：访客不用 GitHub 账号，填个昵称就能留言
- 评论存进 D1，默认「待审核」，后台通过后才显示；支持通过 / 隐藏 / 删除
- 防垃圾：蜜罐字段、同 IP 10 分钟最多 3 条、正文限 1000 字、链接不超过 3 个

### 2026-11-17 · v1.1 桌面端排版重做

- 内容区从 672px 放宽到 1152px，桌面端不用再挤在中间一条
- 首页改成 12 栅格：角色状态、主菜单、任务日志分区排布
- 文章页加右侧目录与「存档信息」栏，正文限宽保证可读性
- 列表、归档、标签、游戏书架在宽屏下改成多栏，并补上页脚导航

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
| 评论 | 自建（D1 存储 + 后台审核，无需第三方登录） |

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
npx wrangler secret put API_TOKEN     # 可选，给脚本 / agent 用
npm run db:remote:seed                # 可选：导入仓库里的旧内容
npm run deploy
```

之后改代码只需要 `npm run deploy`。

不要直接跑 `wrangler deploy`：Astro 适配器构建时会重写 `dist/server/wrangler.json`，把项目根目录配置里的 `routes` 丢掉。`scripts/deploy.mjs` 会把自定义域和 `workers_dev` 补回去再部署，改域名只需要改这个脚本里的 `ROUTES`。

`hallowmuyi.space` 和 `www.hallowmuyi.space` 都已经在脚本里声明，每次部署自动绑定。Worker 默认地址 `https://hallowmuyi-blog.songmy1017.workers.dev` 也保留着，方便验证。

> 如果域名刚从别的项目挪过来，本地可能因为 DNS 负缓存暂时解析不到（`ENOTFOUND`），公网是正常的。可以用 `nslookup hallowmuyi.space 1.1.1.1` 确认，或等最多半小时。

## 环境变量

| 变量 | 用途 | 本地 | 线上 |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | 后台登录密码，同时作为会话 cookie 的签名密钥 | `.dev.vars` | `wrangler secret put ADMIN_PASSWORD` |
| `API_TOKEN` | 可选，给脚本 / agent 的 Bearer token（少于 16 位会被忽略） | `.dev.vars` | `wrangler secret put API_TOKEN` |

两者都是 secret，不要提交到仓库。轮换方式相同：重新 `secret put` 一个值，旧值立即失效。

## 接口

都在 `src/pages/api/`，除登录 / 会话外都需要管理员身份：浏览器用 cookie（`hm_admin`，HMAC 签名，7 天有效），脚本 / agent 用 `Authorization: Bearer <API_TOKEN>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/login` | 密码登录 |
| `GET` | `/api/session` | 当前登录状态 |
| `POST` | `/api/logout` | 退出 |
| `GET` / `POST` | `/api/posts` | 文章列表（`?q=` 搜索、`?full=1` 带正文） / 新建 |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/posts/<slug>` | 单篇读取 / 整体替换 / 局部更新 / 删除 |
| `GET` / `POST` | `/api/games` | 游戏列表（`?q=` 搜索） / 新建 |
| `GET` / `PUT` / `PATCH` / `DELETE` | `/api/games/<slug>` | 单个游戏读取 / 整体替换 / 局部更新 / 删除 |
| `GET` / `PUT` | `/api/game-layout` | 书架默认顺序与首页「近期游戏」精选读取 / 整体替换 |
| `GET` / `PUT` / `PATCH` | `/api/about` | 关于页读取 / 整体替换 / 局部更新 |
| `GET` | `/api/schema` | 机器可读的接口约定（公开，无需认证） |
| `GET` / `POST` | `/api/comments` | 评论列表（`?slug=` 公开只回已通过；管理员可 `?status=`） / 提交评论（公开） |
| `PATCH` / `DELETE` | `/api/comments/<id>` | 审核（通过 / 隐藏） / 删除 |

写操作支持三个约定，脚本和 agent 靠它们安全地改内容：

- **版本号**：`GET` 返回的 `version` 是乐观锁版本；`PUT` / `PATCH` / `DELETE` 时用 `If-Match: <version>` 回传，版本不匹配返回 `409`（附上当前 `version`），记录不存在返回 `412`
- **局部更新**：`PATCH` 只传要改的字段，服务端合并后做完整校验；数组字段是整体替换
- **试运行**：`?dryRun=1` 或 `X-Dry-Run: 1` 只校验不落库

另有 `/rss.xml`、`/sitemap.xml`、`/search-index.json` 三个运行时生成的资源。

### 给脚本和 agent 用的 CLI

管理接口除了浏览器 cookie，还接受 `Authorization: Bearer <API_TOKEN>`，所以脚本不需要处理登录和 cookie。仓库里带了一个薄封装：

```bash
export BLOG_API_TOKEN=...          # 与服务端 API_TOKEN 一致
export BLOG_BASE_URL=http://localhost:4321   # 本地开发时；线上可省略

npm run content -- games list
npm run content -- games list --q 独立游戏
npm run content -- games get hades --json
npm run content -- games upsert --file hades.json    # 不存在则创建，存在则合并更新
npm run content -- games update hades --file patch.json   # 只写要改的字段（PATCH）
npm run content -- posts list --q 像素 --full
npm run content -- posts create --file post.json
npm run content -- posts update hello-world --file patch.json
npm run content -- about update --file about.md
npm run content -- export --out content.json          # 全量导出，改坏之前先备份
npm run content -- schema                              # 打印 /api/schema，机器可读的接口约定
```

约定：

- `--file` 是 JSON，`create` / `upsert` **顶层必须带 `slug`**，`update` 的 slug 来自命令行；`update` / `upsert` 走 `PATCH`，只合并传入的字段，数组整体替换
- 默认带乐观锁：CLI 会先读取当前 `version` 再用 `If-Match` 提交，遇到 `409` 自动重读重试一次；确实想覆盖别人的改动时加 `--force`
- `--dry-run` 只校验不落库，适合在批量写入前检查数据
- 默认输出人类可读的摘要，`--json` 输出原始响应，适合程序解析
- 成功退出码 `0`，参数错误 `2`，接口报错 `1`，错误信息直接来自服务端校验（中文）

接口约定本身也有机器可读版本：[`/api/schema`](https://hallowmuyi.space/api/schema)（公开、缓存 5 分钟），写了每个资源的字段、必填项和错误语义，agent 可以先拉它再决定怎么调。

token 在服务端配置：

```bash
npx wrangler secret put API_TOKEN        # 线上
# 本地写进 .dev.vars：API_TOKEN=...
```

token 等于管理员权限，泄露后轮换即可：重新 `secret put` 一个值，旧值立即失效。

## 数据存在哪

四张表，数组和对象字段以 JSON 字符串存储：

- `posts`：slug、标题、日期、描述、标签、草稿、正文
- `games`：slug、标题、原名、封面、简介、厂商、发售日、平台、类型、官网、我的评分、我的评价、媒体评分、外链、时间线、关联文章、草稿
- `pages`：固定页面（目前只有「关于」）
- `comments`：文章 slug、昵称、邮箱（仅后台可见）、正文、状态（待审核 / 已通过 / 已隐藏）、IP 哈希（仅用于限流）、时间

建表语句在 [db/schema.sql](db/schema.sql)。`src/content/` 只是迁移前的种子数据，日常写作请走 `/admin`——直接改那里的文件不会再影响站点。

## 关于费用

跑在免费额度内：

- **Workers**：10 万请求 / 天，10ms CPU / 请求
- **D1**：500 万行读 / 天，10 万行写 / 天，5GB 存储

页面是 SSR，但 HTML 会在 Worker 里缓存 60 秒（`src/middleware.ts` 的 `CACHE_TTL_SECONDS`），命中缓存时既不查库也不渲染；`/search-index.json` 和 `/sitemap.xml` 另有 `s-maxage=300`。管理员带 `hm_admin` cookie 时一律跳过缓存，所以「保存即生效」不受影响。访问量涨上来还可以再调大 TTL，或给静态资源加更长的 `Cache-Control`。

## 已知限制

- 正文用 `marked` 渲染，没有代码语法高亮（原来是 Astro 内置的 Shiki）；想要的话可以在 `src/lib/markdown.ts` 里接回 shiki
- `/admin` 是预渲染的静态页，只负责前端表单，真正的权限校验在接口层
- 评论是单层的，没有回复 / 楼中楼；也没有邮件或推送通知，需要到 `/admin` 的「评论审核」里看
- 评论防刷只做了蜜罐 + IP 频率限制 + 人工审核，要更强的保护可以接 Cloudflare Turnstile（国内加载可能偏慢）
- 搜索索引每次请求都读全表，文章很多时可以考虑缓存或改全文索引
- 普通访客看到的页面最多可能旧 60 秒（边缘缓存），作者带登录态时不受影响；评论刚通过审核也可能要等缓存过期才出现
