# CLAUDE.md

> 本文是 InfoHub 的**现状参考**（不是前瞻设计稿）。改代码前先读「⚠️ 易踩坑」一节，避免被旧设计文档误导。

## 项目信息

InfoHub — 个人信息聚合网页。从 21 个数据源采集原始新闻，经 **DeepSeek（`deepseek-chat`）** 做跨源去重合并、评分、摘要、分类、翻译，前端展示 AI 精选后的内容。

**技术栈（实际版本）**

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind 4 · shadcn/ui · next-themes · SWR · react-markdown |
| 后端 | Next.js Route Handlers |
| 数据库 | **单库**：本地 SQLite（better-sqlite3 适配器，`file:./dev.db`），生产可切 PostgreSQL（`@prisma/adapter-pg` 已装）· Prisma 7 |
| AI | DeepSeek API（模型硬编码 `deepseek-chat`） |
| 采集 | rss-parser · cheerio · 原生 fetch |
| 定时 | 双机制：Vercel Cron（HTTP 路由）+ node-cron（`instrumentation.ts` 进程内调度） |
| 鉴权 | jose（JWT HS256，cookie `admin_token`，24h） |

---

## 快速命令

```bash
npm run dev                    # 开发服务器
npm run build                  # 构建
npm run lint                   # ESLint

npx prisma db push             # 建表/同步 schema（无迁移文件）
npx prisma generate            # 生成 client 到 src/generated/prisma（已 gitignore）

# 一次性运维脚本（用 npx tsx 跑，tsx 非 dep、靠 npx 临时拉取）
npx tsx scripts/seed-v4.ts     # 最新版种子数据（DataSource 记录）
npx tsx scripts/full-refresh.ts# 全量：先清空再采集 21 源 → AI 处理 6 分类
npx tsx scripts/reclassify-all.ts # 存量数据按内容重分类（修正历史按来源打的 category）

# 手动触发线上全流程（需 CRON_SECRET）
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/trigger?action=full"
```

> `scripts/` 下有大量历史调试脚本（`debug-*`、`diag-*`、`test-*`、`reprocess-*` 等），多为一次性运维用途，不代表当前主流程。主流程入口是 `seed-v4.ts` + `full-refresh.ts`。

---

## ⚠️ 易踩坑（改动前必读）

1. **没有双库**。早期文档（`md/指导文件.md` 等）写的"Main DB / Raw DB 双库分离"**已废弃**。现在 `src/lib/db.ts` 只建一个 PrismaClient，所有表在同一库。不存在 `RAW_DATABASE_URL`。
2. **JSON 字段全部是 `String`**。SQLite 无 `Json` 类型，schema 里 `config` / `tags` / `metadata` / `rawData` 都是 `String`，存的是 `JSON.stringify(...)` 的结果；`tags` 是 String（默认 `"[]"`）**不是 `String[]`**。读写必须手动 `JSON.parse` / `JSON.stringify`。
3. **`importance` 是 `Float` 0–10**（保留 1 位小数），不是 Int 1–10。AI prompt 强制返回小数（如 6.4、8.7），跨源合并事件还会加分。排序、阈值判断都按小数处理。
4. **核心表之间没有 Prisma `@relation`**。`sourceId` 存的是 `DataSource.name`（字符串外键），跨表关联靠应用层 join，不要指望 Prisma 级联。
5. **`RAW_RETENTION_DAYS` 默认 2 天**（不是 14）。`cleanupRawContent` 删 RawContent 时会把对应 ProcessedContent 的 `rawContentId` 置空。
6. **AI 主流程是两遍管线**（`src/lib/pipeline.ts` 的 `processCategory`），不是 `prompts.ts` 里的 `BATCH_PROCESS`。`processBatch` / `PROMPTS.BATCH_PROCESS` 是遗留代码，当前不调用。
7. **`publishedAt` 兜底**：RawContent 的 `publishedAt`（源端发布时间）为空时，ProcessedContent 用 `fetchedAt` 兜底，并在 `metadata.isEstimated=true` 标记。前端日期相关逻辑都按**本地时区**处理（修过 UTC 凌晨跨天 bug，见 git 历史）。
8. **速览缓存是文件**：`.next/cache/overview.json`，24h TTL。本地 `npm run dev` 重建过 `.next` 会丢缓存，首次访问 `/api/ai/overview` 会重新生成（慢）。
9. **`category` 由 AI 按内容打，不是按来源**。`processCategory(sourceCategory)` 的入参只是"取哪些源的 raw 来处理"；写入 ProcessedContent 的 `category` 是 AI 根据**内容**从 `domestic/international/ai/investment/weibo` 里选的（`src/lib/deepseek.ts` 的 `CATEGORY_RULES`），AI 返回非法值才回退到来源板块。**`github` 钉死**——AI 不会把普通新闻分到 github，github-trending 源的内容永远是 github。处理逻辑在 `pipeline.ts` 的 `pickCategory()`。已知限制：去重合并只在同批次内做，跨批次（如同一科技事件分别被国内源和 InfoQ 报道）可能各留一条。

---

## 架构与数据流

```
21 个数据源 ──fetch──▶ RawContent（原始，2 天自动清理）
                          │
                processCategory(category)   ← src/lib/pipeline.ts
                  ├─ Pass1 代码聚类（标题公共子串≥5）+ AI 聚类
                  ├─ Pass2 verifyAndMerge 合并同事件 → sourceCount/sourceNames/加分
                  ├─ scoreSingle 逐条评分+摘要+标签+按内容打 category
                  ├─ translateToChinese（英文/非中文 → 中文）
                  └─ 后处理：修复"摘要≈标题/过短"、补缺失标签
                          │
                          ▼
                  ProcessedContent（精选，长期保留，冗余 sourceId+sourceName）
                          │
            ┌─────────────┼──────────────┬─────────────┐
            ▼             ▼              ▼             ▼
     /api/news      /api/ai/overview  /api/weekly   /api/ai/chat
   （列表/排序/日期） （6 模块速览，缓存） （周报）    （内容问答）
```

GitHub Trending 走独立路径：`fetchGithubTrending` 直接写 `GithubTrending` 表（不进 RawContent/ProcessedContent），由 `/api/github/trending` 读取。

---

## 目录结构

```
src/
├── app/
│   ├── api/
│   │   ├── news/            # GET /api/news（列表）、/news/dates、/news/raw
│   │   ├── github/trending/ # GET GitHub 热榜
│   │   ├── weekly/          # GET 周报
│   │   ├── sources/         # GET 数据源状态
│   │   ├── guestbook/       # 留言板 CRUD + 点赞
│   │   ├── auth/            # login / logout / check（JWT）
│   │   ├── ai/              # overview（速览）/ chat（问答）/ detail（深度概述）
│   │   └── cron/            # daily / weekly / trigger（手动）
│   ├── overview/            # AI 每日速览页
│   ├── news/                # 新闻列表（分类/排序/日期浏览）
│   ├── github/  weekly/  sources/  guestbook/  login/
│   ├── page.tsx             # 首页
│   └── layout.tsx
├── components/              # nav-bar / news-card / detail-modal / date-strip / category-section / carousel + ui/（shadcn）
├── config/prompts.ts        # Prompt 模板（BATCH_PROCESS 遗留、WEEKLY_SUMMARY 在用）
├── lib/
│   ├── db.ts                # 单 PrismaClient
│   ├── pipeline.ts          # ★ AI 两遍处理管线 + cleanupRawContent
│   ├── deepseek.ts          # ★ 所有 AI 调用（聚类/合并/评分/翻译/速览/问答/周报）
│   ├── fetcher-utils.ts     # fetchWithTimeout/Retry、insertRawContents（upsert 去重）、writeFetchLog
│   ├── overview-cache.ts    # 文件缓存读写
│   ├── auth.ts              # JWT 签发/校验
│   └── fetchers/            # 21 个 fetcher + base（rss-base / sina-base）
├── types/index.ts           # 共享类型
└── instrumentation.ts       # node-cron 注册（自托管用）
prisma/schema.prisma         # 数据模型（SQLite）
prisma/seed.ts · scripts/seed-v4.ts   # 种子
scripts/full-refresh.ts      # 全量采集+处理主入口
```

---

## 数据库设计（`prisma/schema.prisma`）

**核心原则**：单库；ProcessedContent 冗余 `sourceId`+`sourceName`，原始数据清理后仍可独立展示；所有可变/扩展字段用 **JSON 字符串** 存（SQLite 兼容）；表之间无 Prisma 关系，靠应用层 join。

| 表 | 用途 | 要点 |
|---|---|---|
| `DataSource` | 数据源配置 | `name` 唯一；`config` 是 JSON 字符串；`type` = rss/rest_api/scraper（仅供展示，实际机制由 fetcher 代码决定） |
| `RawContent` | 原始采集（2 天清理） | `@@unique([sourceId, externalUrl])` + `@@unique([sourceId, externalId])`；`sourceRank` 存源端热度；`publishedAt` 源端发布时间 |
| `ProcessedContent` | AI 精选（长期） | `importance Float`；`tags` 是 JSON 字符串；`metadata` JSON 字符串（`sourceCount`/`sourceNames`/`sourceUrl`/`sourceRank`/`isEstimated`）；`rawContentId` 清理后置空 |
| `GithubTrending` | GitHub 热榜（独立） | `@@unique([repoName, date])`；stars/forks/todayStars |
| `WeeklySummary` | 周报 | `@@unique([weekStart])`；`content` Markdown；`metadata` JSON 字符串 |
| `FetchLog` | 采集日志 | status=success/partial/failed；total/newCount/duration |
| `Guestbook` | 留言板 | content/author/likes |

> 修改 schema 后：`npx prisma db push && npx prisma generate`（本项目用 `db push`，无迁移文件）。

---

## 数据源（21 个活跃，6 分类）

| 分类 (`category`) | 数据源 |
|---|---|
| `domestic` 热点 | 人民网、新浪新闻、新浪社会、新浪军事、百度热搜、澎湃新闻、今日头条、网易新闻 |
| `weibo` 微博 | 微博热搜 |
| `international` 国际 | NHK、新浪国际、环球网、NPR、France24、RT |
| `ai` 科技 | Hacker News、36氪、InfoQ |
| `github` | GitHub Trending |
| `investment` 投资 | 东方财富、新浪财经 |

> `prisma/seed.ts` 还种了 `jiqizhixin`（机器之心）、`cls`（财联社），但**未接入采集管线**（cron/full-refresh 不调用）。新增源要同步在 `instrumentation.ts`、`scripts/full-refresh.ts`、对应 cron 路由里注册 fetcher。

**按实现机制分三类 fetcher（都有 base 模板）：**
- **RSS**（`rss-base.ts` → `fetchRssSource`）：rss-parser 解析，如 renmin/nhk/npr/france24/rt/36kr/infoq。
- **REST/JSON API**（`sina-base.ts` → `fetchSinaSource` 等）：原生 fetch + JSON，如新浪系列、东方财富、微博。
- **爬虫**（cheerio 解析 HTML）：如 thepaper、baidu-hot、huanqiu、github-trending（GitHub Search API + 国内镜像回退）。

---

## Fetcher 规范

**统一返回类型**（`src/types/index.ts`）：

```typescript
interface FetcherResult<T> { success: boolean; data: T[]; source: string; fetchedAt: Date; error?: string; }
interface RawContentInput { sourceId: string; externalId?: string; externalUrl?: string; title: string; content?: string; sourceRank?: number; rawData?: Record<string, unknown>; language?: string; publishedAt?: string; }
```

**要求：**
- 每个 fetcher 独立文件，导出一个 `fetchXxx()` 函数；新源在 `src/lib/fetchers/index.ts` 加导出。
- 超时：单请求 10s（`fetchWithTimeout`），可用 `fetchWithRetry`（3 次指数退避）。
- **去重写入统一走 `insertRawContents(items, sourceId)`**（`fetcher-utils.ts`）：先按 `[sourceId, externalUrl]` upsert，唯一约束冲突再退回 `[sourceId, externalId]`。不要自己写插入。
- 源端有排名/热度就填 `sourceRank`（热搜名次、star 数等，越大越热）。
- 单条失败不中断整批；每次运行 `writeFetchLog`。
- 新源务必同步注册到三处：`instrumentation.ts`、`scripts/full-refresh.ts`、`src/app/api/cron/daily/route.ts`。

---

## DeepSeek / AI 层（`src/lib/deepseek.ts`）

所有 AI 调用集中在此文件，统一经 `chatCompletion`（重试 3 次，1s→2s→4s；`temperature 0.3`，`max_tokens 4096`，模型 `deepseek-chat`）。失败一律降级（返回空/原值），不抛断流程。

**DeepSeek 只负责 5 件事，其余用代码处理**：跨源去重合并、评分、摘要、分类打标、翻译（+周报/速览/问答的内容生成）。

**`processCategory(category, limit)`（`pipeline.ts`）= 实际主流程，两遍设计：**

1. **Pass 1 聚类**：代码层找跨源标题公共子串 ≥5 字的疑似对（并查集合并）+ `clusterByTitle`（AI，批 20）补充 → 合并重叠组。
2. **Pass 2 核实合并**：每组调 `verifyAndMerge`，确认同事件则合并为一条（`sourceCount`/`sourceNames`，importance 按 ≥3 源 +1.5 / ≥2 源 +0.8 加分，上限 10）。AI 否决但代码发现重叠时仍强制合并。
3. **单条评分**：未合并的走 `scoreSingle`（批 15），出 title/summary/importance(小数)/tags/subcategory/**category**。
4. **翻译**：英文或非中文走 `translateToChinese`。
5. **后处理修复**：按本批 `createdIds` 扫描，对"摘要≈标题/过短"或"缺标签"的条目分别调 `regenerateSummary` / `regenerateTags`。

**内容分类（category）**：`verifyAndMerge` 和 `scoreSingle` 都让 AI 按内容从 `domestic/international/ai/investment/weibo` 选一个 category（规则见 `CATEGORY_RULES`）。`pipeline.ts` 的 `pickCategory(aiCategory, sourceCategory)` 决定最终值：github 钉死；AI 合法则采用，否则回退来源板块。`normalizeCategory` 做合法性校验。轻量版 `classifyCategory(items)`（只按标题+摘要、不重生成其他字段）供存量迁移脚本 `scripts/reclassify-all.ts` 复用。

**其它导出函数**：`generateUnifiedOverview`（6 模块速览，写文件缓存）、`generateOverview`（单分类速览）、`generateDetailSummary`（200-300 字深度概述）、`generateSuggestedQuestions`、`chatAboutContent`（问答）、`generateWeeklySummary`、`filterIrrelevant`（分类内容过滤）。

**Prompt 模板**（`src/config/prompts.ts`）：`WEEKLY_SUMMARY` 在用；`BATCH_PROCESS` 是遗留（pipeline 不再调用）。改 prompt 注意：importance 要求小数、标题摘要必须中文、tags 要具体（禁"新闻/热点"等宽泛词）。

---

## 定时任务（双机制并存）

| 机制 | 入口 | 用途 |
|---|---|---|
| **Vercel Cron** | HTTP 打 `/api/cron/daily`、`/api/cron/weekly`，`Authorization: Bearer $CRON_SECRET` 鉴权 | Vercel 部署 |
| **node-cron** | `src/instrumentation.ts`，服务启动时 `register()` 注册进程内调度 | 自托管（PM2/Docker） |
| **手动** | `GET /api/cron/trigger?action=full\|fetch\|process\|cleanup&category=` | 调试/补跑 |

调度由环境变量控制（`instrumentation.ts`）：`CRON_SCHEDULE`（默认 `0 8 * * *` 每日）、`CRON_WEEKLY_SCHEDULE`（默认 `0 9 * * 1` 每周一）。注释掉则不启用 node-cron。

**每日任务**：采集 21 源 → `processCategory` 处理 6 分类 → `cleanupRawContent` → 刷新速览缓存。
**周报任务**：取近 7 天 `importance ≥ 7` → `generateWeeklySummary` → 写 `WeeklySummary`。

---

## API 路由

- `GET /api/news?category=&sort=rating|multi&page=&limit=&date=YYYY-MM-DD` — 精选列表。`sort=multi` 按 `metadata.sourceCount` 降序（多源优先）。
- `GET /api/news/dates?category=` — 有数据的日期列表（本地时区）。
- `GET /api/news/raw?source=` — 原始数据（调试）。
- `GET /api/github/trending?date=&sort=` — GitHub 热榜。
- `GET /api/weekly?week=` — 周报。
- `GET /api/sources` — 数据源运行状态。
- `GET /api/ai/overview`（读文件缓存，MISS 时生成）/ `POST`（强制刷新，需 CRON_SECRET）。
- `POST /api/ai/chat`、`POST /api/ai/detail` — 内容问答 / 深度概述。
- `GET|POST /api/guestbook` — 留言板（删留言需 admin）。
- `POST /api/auth/login|logout`、`GET /api/auth/check` — JWT 登录态。

**统一响应格式**（`src/types/index.ts`）：`{ success, data?, meta?:{page,limit,total}, error?:{code,message} }`。

---

## 编码规范

**TypeScript**：`strict: true`，禁止 `any`（用 `unknown`）；所有函数标注参数与返回值类型；对象结构用 `interface`，联合类型用 `type`。

**命名**：变量/函数 camelCase（`fetchDomesticNews`）；常量 UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）；类型/接口/组件 PascalCase（`NewsItem`、`NewsCard`）；组件文件 PascalCase.tsx，工具文件 kebab-case.ts；API 路由 kebab-case；环境变量 UPPER_SNAKE_CASE。

**文件组织**：单文件 ≤ 300 行（超了拆）；组件文件只导出一个默认组件；类型放 `src/types/`。

**前端**：优先 React Server Components；客户端取数用 SWR；只用 Tailwind 工具类（全局样式除外）；用 shadcn/ui + Lucide React 图标；图片用 `next/image` 带 alt；组件单文件 ≤ 150 行 JSX；建前端页面前先读 `frontend-design` skill。

**错误处理**：所有外部调用 try-catch；日志含 模块/操作/错误/上下文/时间戳；单 fetcher 失败不影响其他；AI 调用失败降级，原始数据仍入库。

---

## 扩展指南

- **新增数据源**：① 写 `src/lib/fetchers/xxx.ts`（套对应 base 模板）→ ② `index.ts` 导出 → ③ `seed` 脚本加 DataSource 记录 → ④ 注册到 `instrumentation.ts` + `scripts/full-refresh.ts` + `api/cron/daily/route.ts`。
- **新增板块**：`category` 字段加值（同步 `NewsCategory` 类型、cron 的 `CATEGORIES`、速览 `MODULES`）。
- **新增字段**：优先塞进 `metadata`/`rawData` 的 JSON 字符串里，稳定后再考虑加独立列。
- **新功能表**（如用户偏好/收藏）：独立建表。

---

## 环境变量（`.env.local` 不提交）

| 变量 | 说明 | 默认 |
|---|---|---|
| `DATABASE_URL` | 单库连接 | `file:./dev.db`（SQLite） |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥 | 必填 |
| `DEEPSEEK_BASE_URL` | API 地址 | `https://api.deepseek.com` |
| `NEWS_API_KEY` / `TIANXING_API_KEY` | 数据源 Key（多数源不需要） | 可选 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 管理员登录 | `admin` / 必填 |
| `CRON_SECRET` | 定时任务 + 手动触发鉴权（≥32 字符）；未设/过短则跳过鉴权 | 可选 |
| `RAW_RETENTION_DAYS` | 原始数据保留天数 | `2` |
| `CRON_SCHEDULE` / `CRON_WEEKLY_SCHEDULE` | node-cron 表达式（自托管） | `0 8 * * *` / `0 9 * * 1` |

---

## Git 规范

- Commit：`type(scope): 描述`，type = feat / fix / docs / refactor / test / chore。例：`feat(fetcher): 完成 RSS 类通用采集模板`。
- 一次只做一件事，跑通再继续；先数据库 → fetcher → AI 处理 → API → 前端；每完成一个模块先验证。
- 数据源走配置化，不要硬编码 URL。
