
# CLAUDE.md

## 项目信息

InfoHub — 个人信息聚合网页。多数据源采集原始数据，DeepSeek V4 Pro 进行去重/排名/摘要/分类，前端展示精选内容。

技术栈：Next.js 14+ App Router, TypeScript, Tailwind CSS + shadcn/ui, Prisma + PostgreSQL（双库）, DeepSeek V4 Pro API。

## 编码规范

### TypeScript

- `strict: true`，禁止 `any`，用 `unknown` 替代
- 所有函数必须有参数和返回值类型注解
- 对象结构用 `interface`，联合类型用 `type`

### 命名

- 变量/函数：camelCase（`fetchDomesticNews`）
- 常量：UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- 类型/接口/组件：PascalCase（`NewsItem`、`NewsCard`）
- 文件（组件）：PascalCase.tsx；文件（工具）：kebab-case.ts
- API 路由：kebab-case（`/api/github/trending`）
- 环境变量：UPPER_SNAKE_CASE

### 文件组织

- 单文件不超过 300 行，超过就拆
- 组件文件只导出一个默认组件
- 类型定义放 `src/types/`

---

## 数据库设计

### 核心原则

**双库分离**：主库（Main DB）存储精选展示数据（ProcessedContent、DataSource、GithubTrending、WeeklySummary 等），原始库（Raw DB）只存 RawContent，14 天后自动清理。

- Main DB：前端直接读取，长期保留
- Raw DB：仅供采集写入 + AI 处理读取，按 `createdAt` 自动清理超过 14 天的数据
- 两者通过 `rawContentId` 关联，但 ProcessedContent 同时冗余 `sourceId` + `sourceName`，确保原始数据清理后仍可独立显示来源

所有扩展字段使用 JSON 类型（Prisma 的 `Json`），避免频繁改表结构。

### Prisma Schema 要点

```prisma
// 数据源配置 — 新增数据源只需加记录
model DataSource {
  id          String   @id @default(cuid())
  name        String   @unique        // 如 "weibo", "newsapi", "jiqizhixin"
  displayName String                  // 如 "微博热搜", "NewsAPI"
  category    String                  // domestic / international / ai / github / investment
  type        String                  // rss / rest_api / scraper
  config      Json                    // { url, apiKey, headers, selector... } 各源不同的配置
  schedule    String?                 // cron 表达式，如 "0 8,12,18 * * *"
  isActive    Boolean  @default(true)
  lastFetchAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  rawContents RawContent[]
  fetchLogs   FetchLog[]
}

// 原始采集数据 — 存储在 Raw DB，14 天后自动清理
model RawContent {
  id           String   @id @default(cuid())
  sourceId     String
  externalId   String?                // 源端唯一 ID（用于去重）
  externalUrl  String?                // 原文链接
  title        String
  content      String?  @db.Text      // 原始正文（可为空）
  sourceRank   Int?                   // 源端原始排名/热度（微博热搜第几名、GitHub 多少 star 等），供 AI 评分参考
  rawData      Json?                  // 源端返回的完整原始 JSON
  language     String   @default("zh") // zh / en
  fetchedAt    DateTime @default(now())
  createdAt    DateTime @default(now())

  @@unique([sourceId, externalUrl])   // 同一来源同一 URL 不重复
  @@unique([sourceId, externalId])    // 同一来源同一 ID 不重复
  @@index([sourceId, fetchedAt])
  @@index([createdAt])                // 用于清理过期数据
}

// AI 处理后的精选内容 — 主库存储，前端展示用
model ProcessedContent {
  id            String   @id @default(cuid())
  rawContentId  String?  @unique      // 关联原始数据，14 天后原始清理则置空
  sourceId      String                 // 冗余来源引用，确保原始数据清理后仍可追溯
  sourceName    String                 // 冗余来源显示名，如"微博热搜"，前端直接展示
  category      String                 // domestic / international / ai / github / investment
  subcategory   String?                // 二级分类，如 ai→大模型/芯片/应用
  title         String                 // AI 整理后的标题（中文）
  summary       String                 // AI 生成的摘要（100字内）
  importance    Int      @default(5)   // AI 评分 1-10
  tags          String[] @default([])  // AI 打的标签
  language      String   @default("zh")
  metadata      Json?                  // 扩展字段（如投资类的行情数据、GitHub 的 star 数等）
  processedAt   DateTime @default(now())
  publishedAt   DateTime               // 原始发布时间
  createdAt     DateTime @default(now())

  @@index([sourceId])
  @@index([category, publishedAt])
  @@index([category, importance])
  @@index([publishedAt])
}

// GitHub 热榜（独立表，结构差异大）
model GithubTrending {
  id          String   @id @default(cuid())
  repoName    String                  // owner/repo
  description String?
  language    String?
  stars       Int      @default(0)
  forks       Int      @default(0)
  todayStars  Int      @default(0)
  repoUrl     String
  date        DateTime @db.Date       // 哪一天的榜单
  createdAt   DateTime @default(now())

  @@unique([repoName, date])
  @@index([date])
  @@index([language, date])
}

// 周报
model WeeklySummary {
  id         String   @id @default(cuid())
  weekStart  DateTime @db.Date
  weekEnd    DateTime @db.Date
  content    String   @db.Text        // Markdown 格式
  metadata   Json?                    // 扩展字段
  generatedAt DateTime @default(now())
  createdAt  DateTime @default(now())

  @@unique([weekStart])
}

// 采集日志
model FetchLog {
  id         String   @id @default(cuid())
  sourceId   String
  source     DataSource @relation(fields: [sourceId], references: [id])
  status     String                   // success / partial / failed
  total      Int      @default(0)     // 采集总条数
  newCount   Int      @default(0)     // 新增条数（去重后）
  duration   Int      @default(0)     // 耗时毫秒
  message    String?  @db.Text        // 错误信息或备注
  fetchedAt  DateTime @default(now())

  @@index([sourceId, fetchedAt])
  @@index([fetchedAt])
}
```

### 扩展方式

- 新增数据源：DataSource 表加一条记录 + 写一个 fetcher 文件
- 新增板块：category 字段加新值即可
- 新增字段：优先放 metadata/rawData 的 JSON 里，确定稳定后再加独立字段
- 新增功能表：如 UserPreference、UserBookmark 等，独立建表关联

### 原始数据自动清理

Raw DB 中的 RawContent 保留 14 天后自动删除。实现方式：

- 定时任务每日凌晨执行：`DELETE FROM raw_content WHERE created_at < NOW() - INTERVAL '14 days'`
- 同时将主库中对应 ProcessedContent 的 `rawContentId` 置空（通过批量查主库匹配后更新）
- 清理前后记录日志（清理条数、耗时）
- 配置项 `RAW_RETENTION_DAYS` 控制保留天数，默认 14

---

## Fetcher 规范

### 统一接口

```typescript
interface FetcherResult<T> {
  success: boolean;
  data: T[];
  source: string;
  fetchedAt: Date;
  error?: string;
}
```

### 要求

- 每个 fetcher 独立文件，互不依赖
- HTTP 请求 10s 超时，整个 fetcher 60s 总超时
- 去重：写入前按 sourceId + externalUrl 或 sourceId + externalId 检查
- 源端有排名/热度数据时填入 `sourceRank`（热搜名次、star 数、点赞数等），数值越大越热门
- 单条处理失败不中断整批，错误记录到数组
- 每次运行写入 FetchLog

### 三类 fetcher 模板

根据接入方式分三类，新数据源选对应模板即可：

1. **RSS 类**（机器之心、BBC、Reuters 等）— 用 rss-parser 解析
2. **REST API 类**（天行数据、NewsAPI、CoinGecko 等）— 标准 HTTP 请求
3. **爬虫类**（GitHub Trending、微博热搜、今日热榜等）— cheerio 解析 HTML

### 数据源配置化

fetcher 的行为通过 DataSource 表的 config JSON 字段驱动，不要硬编码 URL 和参数：

```typescript
// config 示例
// RSS 类: { "feedUrl": "https://www.jiqizhixin.com/rss" }
// API 类: { "baseUrl": "https://newsapi.org/v2", "endpoint": "/top-headlines", "params": { "country": "us" } }
// 爬虫类: { "url": "https://github.com/trending", "selectors": { "repo": "article.Box-row" } }
```

---

## DeepSeek API 规范

### 职责范围

DeepSeek 负责以下 5 件事，其他用代码处理：

1. **去重排名**：一批原始新闻 → 识别重复事件，按重要性评分 1-10
2. **摘要生成**：长文 → 100 字中文摘要
3. **分类打标**：分配二级分类和标签
4. **翻译**：英文标题/摘要 → 中文
5. **周报生成**：一周精选 → 结构化 Markdown

### 调用规范

- 所有 AI 调用统一走 `src/lib/deepseek.ts`
- 重试 3 次，指数退避（1s → 2s → 4s）
- 失败降级：返回原始内容写入，标记为未处理
- Prompt 模板集中在 `src/config/prompts.ts`
- 批量处理：一次调用传入 5-10 条新闻，减少请求次数
- 要求 DeepSeek 返回 JSON 格式，便于解析

### Prompt 模板格式

```typescript
export const PROMPTS = {
  BATCH_PROCESS: {
    version: '1.0',
    template: `你是专业新闻编辑。请处理以下{{count}}条新闻：
1. 识别报道同一事件的新闻，只保留最详细的一条
2. 为每条新闻评分（1-10，10最重要）
3. 生成不超过100字的中文摘要
4. 分配分类标签

每条新闻会附带 `sourceRank`（源端原始排名/热度，数值越大越热门），请参考此值但不要机械照搬——同一事件跨源报道时，综合判断而非简单比大小。

新闻列表：
{{items}}

请以 JSON 数组格式返回，每条包含：id, importance, summary, tags, isDuplicate, duplicateOf`,
  },
} as const;
```

---

## 前端开发

- 优先使用 React Server Components
- 客户端数据获取用 SWR
- 只用 Tailwind 工具类，不写自定义 CSS（全局样式除外）
- 使用 shadcn/ui 组件，用 Lucide React 图标
- 图片用 `next/image` 懒加载，必须有 alt
- 组件单文件不超过 150 行 JSX
- 创建前端页面时先读取 frontend-design skill

## API 响应格式

```typescript
// 成功
{ success: true, data: T, meta?: { page, limit, total } }
// 失败
{ success: false, error: { code: string, message: string } }
```

## 错误处理

- 所有外部调用必须 try-catch
- 错误日志包含：模块名、操作、错误信息、上下文、时间戳
- 单个 fetcher 失败不影响其他 fetcher
- AI 调用失败降级：原始数据仍入库，标记 processedAt 为空

## 环境变量

```
DATABASE_URL=           # 主库（ProcessedContent、DataSource 等，长期保留）
RAW_DATABASE_URL=       # 原始库（仅 RawContent，14 天自动清理）
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
NEWS_API_KEY=
TIANXING_API_KEY=
CRON_SECRET=            # 不少于32字符
RAW_RETENTION_DAYS=14   # 原始数据保留天数
```

`.env.local` 不提交 Git。

## Git 规范

- Commit：`type(scope): 描述`
- type: feat / fix / docs / refactor / test / chore
- 示例：`feat(fetcher): 完成 RSS 类通用采集模板`

## 开发策略

- 一次只做一件事，跑通再继续
- 先数据库 → 再 fetcher → 再 AI 处理 → 再 API → 最后前端
- 每完成一个模块先运行验证
- 新数据源走配置化，不要硬编码
