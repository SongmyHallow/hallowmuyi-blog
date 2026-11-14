# 游戏书架设计文档

> 状态：已实施并上线（commit `eb58389`） · v1 · 2026-11-14
> 范围：新增 `/games` 游戏书架、`/games/[slug]` 详情页、顶栏入口、后台游戏管理与游戏接口。色板、字体、组件体系沿用 pixel-design.md，不新增颜色。

---

## 一、目标

博客原本只有文章，玩过的游戏没有沉淀的地方。新增「游戏书架」，用类似 Steam 库的封面墙陈列游戏，并把游戏与博客文章、外部资料、版本更新记录串起来，形成长期可维护的个人游戏档案。

设计原则：

- 复用现有像素风组件与深浅色体系，不引入第三方 UI 库。
- 静态优先：书架与详情页在构建期生成，排序在浏览器端完成。
- 数据由现有后台维护：保存即提交 GitHub，约 1 分钟后自动部署。

---

## 二、信息架构

| 路由 | 页面 | 说明 |
|---|---|---|
| `/games` | 游戏书架 | 封面网格 + 三种排序，默认最近更新 |
| `/games/[slug]` | 游戏详情 | 基本信息、评分、关联博客、外链存档、版本时间线 |
| `/admin` | 后台 | 新增「游戏管理」视图 |
| `/api/games` | 接口 | 列表 / 新建 |
| `/api/games/[slug]` | 接口 | 读取 / 更新 / 删除 |

顶栏导航顺序：文章 · 归档 · 标签 · **游戏书架** · 关于。

---

## 三、数据模型

每个游戏对应一个 JSON 文件：`src/content/games/<slug>.json`，文件名即 slug，规则与后台文章一致（小写字母、数字、连字符）。使用 Astro `glob` loader 读取并在构建期用 zod 校验。

```json
{
  "title": "游戏名",
  "originalTitle": "Original Title",
  "cover": "https://example.com/cover.jpg",
  "summary": "一句话简介",
  "developer": "开发商",
  "publisher": "发行商",
  "releaseDate": "2024-02-21",
  "addedAt": "2026-11-01",
  "updatedAt": "2026-11-14",
  "platforms": ["PC", "PS5"],
  "genres": ["动作", "RPG"],
  "officialUrl": "https://example.com",
  "scores": [{ "source": "IGN", "score": "9.0/10" }],
  "relatedPosts": ["hello-world"],
  "links": [
    {
      "title": "文章标题",
      "url": "https://example.com/article",
      "type": "article",
      "note": "可选备注",
      "date": "2026-10-01"
    }
  ],
  "timeline": [
    {
      "version": "1.2",
      "date": "2026-10-10",
      "summary": "关键更新内容",
      "url": "https://example.com/patch-notes"
    }
  ],
  "draft": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 游戏名称 |
| `originalTitle` | string | 否 | 原名 |
| `cover` | URL | 是 | 封面外链，不做上传 |
| `summary` | string | 否 | 卡片与详情页简介 |
| `developer` / `publisher` | string | 否 | 开发商 / 发行商 |
| `releaseDate` | date | 否 | 发售日期 |
| `addedAt` | date | 是 | 加入书架日期 |
| `updatedAt` | date | 否 | 最近编辑日期，后台保存时由服务端写入 |
| `platforms` / `genres` | string[] | 否 | 平台 / 类型 |
| `officialUrl` | URL | 否 | 官网 |
| `scores` | `{source, score}[]` | 否 | 媒体评分，分数为字符串，兼容 `9.0/10`、`88`、`特别好评` |
| `relatedPosts` | string[] | 否 | 关联博客 slug |
| `links` | `{title, url, type, note?, date?}[]` | 否 | 外部文章 / 视频存档，`type` 为 `article` 或 `video` |
| `timeline` | `{version, date, summary, url?}[]` | 否 | 版本更新记录，非空才展示时间线 |
| `draft` | boolean | 否 | 草稿不生成页面、不进书架、不进 sitemap |

约定：

- 日期统一 `YYYY-MM-DD`，构建期转为 `Date`。
- 数组字段缺省为空数组。
- 字段缺失或 URL 非法时构建失败，错误信息会指出具体文件。

---

## 四、游戏书架页 `/games`

服务端按「最近更新」渲染全部非草稿游戏，浏览器端负责切换排序，无需额外请求。

### 4.1 布局

- 页头：`游戏书架` + `GAME SHELF · TOTAL n`。
- 排序按钮：`最近更新` / `加入书架` / `发售时间`，使用 `px-btn`，选中态通过 `aria-pressed="true"` 反色。
- 网格：手机 2 列、平板 3 列、桌面 4 列；封面固定 3:4 竖版。
- 卡片：2px 边框 + 4px 硬阴影；hover / 键盘 focus 时边框变强调色并轻微上移；封面加载失败时隐藏图片但保留游戏名；长线游戏在封面右上角显示最新版本号。
- 空状态：像素卡片提示「NO GAMES」，附前往文章列表的入口。

### 4.2 排序口径

| 模式 | 参数 | 排序键（降序） |
|---|---|---|
| 最近更新 | `updated`（默认） | `max(updatedAt, timeline 最新日期, addedAt)` |
| 加入书架 | `added` | `addedAt` |
| 发售时间 | `release` | `releaseDate`，无发售日期排最后 |

同值时按 `title.localeCompare(..., 'zh-CN')` 排序，保证顺序稳定。

### 4.3 交互

- 点击按钮即时重排 DOM，并同步 URL：`/games/?sort=release`。
- 直接访问带参数链接时按参数排序；非法参数回退 `updated` 并规范化 URL。
- 无 JS 时按服务端默认顺序展示，功能不报错。

---

## 五、游戏详情页 `/games/[slug]`

`getStaticPaths` 过滤草稿，仅为已发布游戏生成页面。桌面为「封面 + 信息」两栏，移动端单栏堆叠。

区块顺序：

1. **基本信息**：封面、名称、原名、简介、开发商、发行商、发售日期、平台、类型、官网链接（新窗口）。空字段不显示对应行。
2. **媒体评分**：有 `scores` 时以「媒体名 + 分数」徽章展示，无则不渲染。
3. **关联博客**：按 `relatedPosts` 查找已发布文章，展示标题与日期并链接到 `/blog/<slug>/`；不存在或草稿 slug 静默跳过。
4. **外部链接存档**：展示类型（文章 / 视频）、标题、可选备注与日期，外链新窗口。
5. **版本时间线**：`timeline` 非空时按日期倒序展示版本号、日期、更新内容与可选「更新日志 →」链接；为空则整个区块不渲染。

页面顶部提供「← 返回书架」；已登录管理员额外看到「编辑此游戏」，跳转 `/admin?game=<slug>` 直接打开编辑器。

---

## 六、后台游戏管理

`/admin` 新增与文章视图平级的「游戏管理」视图，复用现有登录态与 `api()` 401 处理。

### 6.1 列表

- 封面缩略图、标题、slug、草稿标记。
- 「+ 新游戏」「← 返回文章」「退出」。
- 每项提供编辑 / 删除；删除前确认，删除会把 JSON 文件从仓库移除。

### 6.2 编辑器

字段：slug（新建可填、编辑只读）、标题、原名、封面 URL（实时预览）、简介、开发商、发行商、发售日期、加入书架日期、平台、类型、官网、草稿。

三组动态行：

- **评分**：来源 + 分数，可增删行。
- **相关链接**：标题、URL、类型（文章 / 视频）、备注、日期，可增删行。
- **更新记录**：版本、日期、更新内容、更新日志 URL，可增删行。

关联博客为逗号分隔 slug，并通过 `/api/posts` 生成候选提示（datalist）。

### 6.3 保存流程

- 新建 `POST /api/games`，编辑 `PUT /api/games/<slug>`。
- 客户端校验标题、封面、加入书架日期与 URL 格式；完全空白的动态行会被跳过。
- 服务端 `normalizeGame` 再次校验并清洗，`updatedAt` 按北京时间写为当天（忽略客户端传值）。
- 通过 GitHub Contents API 写入 `src/content/games/<slug>.json`，提交到 `master`，触发 Cloudflare Pages 自动部署。

---

## 七、接口契约

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/games` | 返回 `{ games: [{ slug, title, cover, draft, addedAt, updatedAt }] }` |
| POST | `/api/games` | 请求 `{ slug, game }`，新建 |
| GET | `/api/games/<slug>` | 返回 `{ sha, game }` |
| PUT | `/api/games/<slug>` | 请求 `{ game }`，更新 |
| DELETE | `/api/games/<slug>` | 删除 |

- 全部接口复用 `hm_admin` cookie 会话，未登录返回 401。
- slug 必须匹配 `^[a-z0-9][a-z0-9-]*$`。
- 标题 / 封面缺失或格式非法返回 400；GitHub 文件不存在返回 404；其他写入失败返回 500，且不向客户端透出 token。

---

## 八、SEO、站点集成与主题

- 页面标题：`游戏书架 · MUYI BLOG`、`<游戏名> · MUYI BLOG`。
- canonical / og:url 自动使用 `https://hallowmuyi.space` 下的对应绝对地址。
- sitemap 自动包含 `/games/` 与所有非草稿详情页，仍排除 `/admin`。
- RSS 保持只输出博客文章，不包含游戏。
- 新页面完整使用现有主题变量与 `.dark` 切换，切换无白闪、刷新保持。
- 游戏条目不进入站内搜索索引（本次范围外）。

---

## 九、非目标

- 不自动抓取 Steam / Metacritic 等平台的评分或游戏信息。
- 不做封面图上传，仅支持外链 URL。
- 不做游戏搜索、分页、平台 / 类型筛选。
- 不把游戏加入 RSS 或站内搜索索引。
- 不重做后台整体视觉风格，游戏管理沿用现有后台样式。

---

## 十、验收与回归

本地：

- `npm run build` 零错误；非法游戏数据构建失败并指出文件。
- 三种排序、URL 参数、详情页各区块、关联博客过滤、空状态、深浅色均通过浏览器验证。
- canonical、标题、OG 描述符合预期。

线上（`https://hallowmuyi.space`）：

- `/games/`、`/admin/`、`/rss.xml`、`/sitemap-0.xml` 均返回 200。
- `sitemap-0.xml` 含 `/games/`，不含 `/admin`；RSS 仍只有 1 篇博客。
- 未登录访问 `/api/games` 返回 401，Functions 正常生效。
- 顶栏入口、空状态、主题切换与刷新保持均通过。
- 书架当前为空，添加首款游戏后详情页才会生成。

---

## 十一、使用方式

1. 登录 `/admin`。
2. 点击「游戏管理」→「+ 新游戏」。
3. 填写 slug、标题、封面 URL、加入书架日期等必填项，按需添加评分、外链与版本记录。
4. 保存后约 1 分钟自动上线；之后可从详情页「编辑此游戏」直接回到编辑器。
