// Fetcher 统一返回格式
export interface FetcherResult<T> {
  success: boolean;
  data: T[];
  source: string;
  fetchedAt: Date;
  error?: string;
}

// RawContent 写入参数（不含 id/createdAt 等自动生成字段）
export interface RawContentInput {
  sourceId: string;
  externalId?: string;
  externalUrl?: string;
  title: string;
  content?: string;
  sourceRank?: number;
  rawData?: Record<string, unknown>;
  language?: string;
  publishedAt?: string; // ISO 字符串，新闻源端发布时间
}

// AI 处理输入
export interface AIProcessInput {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  content?: string;
  sourceRank?: number;
  externalUrl?: string;
  language: string;
  publishedAt: string;
}

// AI 处理输出
export interface AIProcessOutput {
  id: string;
  title: string;
  summary: string;
  importance: number;
  tags: string[];
  subcategory: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  irrelevant?: boolean;
  sourceCount?: number;
  sourceNames?: string[];
  mergedIds?: string[];
}

// API 统一响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// 数据源分类
export type NewsCategory = 'domestic' | 'international' | 'ai' | 'github' | 'investment' | 'weibo';

// 采集日志状态
export type FetchStatus = 'success' | 'partial' | 'failed';
