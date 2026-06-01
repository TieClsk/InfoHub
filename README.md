# InfoHub — 个人信息聚合网页 / Personal Information Aggregator

[English](#english) | [中文](#chinese)

---

## English

### Overview

InfoHub is a personal news aggregation platform that collects content from **21 data sources** across 6 categories, uses **DeepSeek V4 Pro** for AI-powered deduplication, scoring, summarization, and classification, then displays curated content on a modern web interface.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL (Vercel) / SQLite (local dev) |
| ORM | Prisma 7 |
| AI | DeepSeek V4 Pro API |
| Deployment | Vercel + Vercel Cron |

### Features

- **6 Content Categories**: Hot News, Weibo Trends, International, AI & Tech, GitHub Trending, Investment
- **AI Processing**: Deduplication, 0-10 scoring, 100-word summaries, multi-language translation, labeling
- **Cross-source Verification**: Same-event detection across sources, weighted scoring
- **Daily Overview**: AI-generated briefing across all categories with Markdown rendering
- **AI Q&A**: Question-answering based on news content with suggested questions
- **GitHub Trending**: Daily trending repos with star count display and sort options
- **Weekly Reports**: Auto-generated structured Markdown reports
- **Date Browser**: Browse past news by date
- **Guestbook**: Public feedback board with likes
- **Admin System**: JWT-based login, message deletion
- **Dark Mode**: Light/Dark/System theme switching
- **Responsive**: Mobile-friendly layout

### Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DEEPSEEK_API_KEY

# Initialize database
npx prisma db push
npx prisma generate

# Run seed data + fetch all sources + AI process
npx tsx scripts/seed-v4.ts
npx tsx scripts/full-refresh.ts

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | DB connection | `file:./dev.db` (SQLite) |
| `DEEPSEEK_API_KEY` | DeepSeek API key | Required |
| `DEEPSEEK_BASE_URL` | API base URL | `https://api.deepseek.com` |
| `CRON_SECRET` | Cron auth (≥32 chars) | Optional |
| `ADMIN_USERNAME` | Admin login | `admin` |
| `ADMIN_PASSWORD` | Admin password | Required |
| `RAW_RETENTION_DAYS` | Raw data TTL | `14` |

### Data Sources (21 total)

| Category | Sources |
|----------|---------|
| Hot News | 人民网, 新浪新闻, 新浪社会, 百度热搜, 澎湃新闻, 今日头条, 网易新闻 |
| Weibo | 微博热搜 API |
| International | NHK, 新浪国际, 新浪军事, 环球网, NPR, France24, RT News |
| AI & Tech | Hacker News, 36Kr, InfoQ |
| GitHub | GitHub Trending |
| Investment | 东方财富, 新浪财经 |

### Deployment (Vercel)

```bash
npm i -g vercel
vercel login
vercel
```

Set environment variables in Vercel dashboard → Settings → Environment Variables:

- `DATABASE_URL` — PostgreSQL connection string
- `DEEPSEEK_API_KEY` — Your API key
- `CRON_SECRET` — ≥32 chars random string
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`

Then push database schema:

```bash
vercel env pull .env.production
npx prisma db push
```

Cron jobs run automatically: daily at 8:00 & 20:00 (Beijing time), weekly on Monday 9:00.

### Project Structure

```
src/
├── app/
│   ├── api/           # Route handlers (news, cron, auth, guestbook, ai)
│   ├── github/        # GitHub trending page
│   ├── guestbook/     # Feedback board
│   ├── login/         # Admin login
│   ├── news/          # News list with filtering
│   ├── overview/      # AI daily briefing
│   ├── sources/       # Data source status
│   └── weekly/        # Weekly report
├── components/        # Reusable UI components
├── config/            # AI prompt templates
├── lib/               # Core logic (db, deepseek, pipeline, fetchers)
└── types/             # TypeScript type definitions
```

---

## 中文

### 概述

InfoHub 是一个个人信息聚合平台，从 **21 个数据源** 采集 6 大板块内容，通过 **DeepSeek V4 Pro** 进行 AI 去重、评分、摘要、分类，最终在现代化网页界面上展示精选内容。

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| 后端 | Next.js Route Handlers |
| 数据库 | PostgreSQL (Vercel) / SQLite (本地开发) |
| ORM | Prisma 7 |
| AI | DeepSeek V4 Pro API |
| 部署 | Vercel + Vercel Cron |

### 功能特性

- **6 大内容板块**：热点新闻、微博舆论、国际热点、AI 动态、GitHub 热榜、投资资讯
- **AI 智能处理**：去重、0-10 小数评分、100 字摘要、多语言翻译、自动打标签
- **跨源交叉验证**：自动识别多来源报道的同一事件，多源加权评分
- **每日速览**：AI 综合各领域 Top10 生成结构化概览，支持 Markdown 渲染
- **AI 问答**：基于新闻内容自由提问，附带推荐问题
- **GitHub 热榜**：每日趋势仓库，显示今日 Star 数，支持评分/Star 排序切换
- **周报生成**：每周一自动生成结构化 Markdown 周报
- **日期浏览**：按日期查看过往新闻，有数据的日期高亮可点
- **留言板**：公开反馈留言，支持点赞
- **管理员系统**：JWT 登录，删除违规留言
- **暗色模式**：亮色/暗色/跟随系统
- **响应式布局**：适配手机/平板/桌面

### 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 初始化数据库
npx prisma db push
npx prisma generate

# 种子数据 + 全量采集 + AI 处理
npx tsx scripts/seed-v4.ts
npx tsx scripts/full-refresh.ts

# 启动开发服务器
npm run dev
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 | `file:./dev.db` (SQLite) |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 必填 |
| `DEEPSEEK_BASE_URL` | API 地址 | `https://api.deepseek.com` |
| `CRON_SECRET` | 定时任务鉴权(≥32位) | 可选 |
| `ADMIN_USERNAME` | 管理员账号 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | 必填 |
| `RAW_RETENTION_DAYS` | 原始数据保留天数 | `14` |

### 数据源（共 21 个）

| 板块 | 来源 |
|------|------|
| 热点新闻 | 人民网、新浪新闻、新浪社会、百度热搜、澎湃新闻、今日头条、网易新闻 |
| 微博 | 微博热搜 API |
| 国际热点 | NHK、新浪国际、新浪军事、环球网、NPR、France24、RT News |
| AI 科技 | Hacker News、36氪、InfoQ |
| GitHub | GitHub Trending |
| 投资资讯 | 东方财富、新浪财经 |

### Vercel 部署

```bash
npm i -g vercel
vercel login
vercel
```

在 Vercel 控制台 Settings → Environment Variables 设置：

- `DATABASE_URL` — PostgreSQL 连接字符串
- `DEEPSEEK_API_KEY` — API 密钥
- `CRON_SECRET` — ≥32 位随机字符串
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`

然后推送表结构：

```bash
vercel env pull .env.production
npx prisma db push
```

Cron 定时任务自动运行：每日早 8:00 和晚 20:00（北京时间），每周一 9:00 生成周报。

### 项目结构

```
src/
├── app/
│   ├── api/           # 路由处理（新闻/定时/认证/留言/AI）
│   ├── github/        # GitHub 热榜页
│   ├── guestbook/     # 留言板
│   ├── login/         # 管理员登录
│   ├── news/          # 新闻列表（分类筛选/排序/日期浏览）
│   ├── overview/      # AI 每日速览
│   ├── sources/       # 数据源运行状态
│   └── weekly/        # 周报展示
├── components/        # 可复用 UI 组件
├── config/            # AI Prompt 模板
├── lib/               # 核心逻辑（数据库/AI/管道/采集器）
└── types/             # TypeScript 类型定义
```

### License

MIT
