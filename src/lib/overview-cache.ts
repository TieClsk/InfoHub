/**
 * 速览缓存 — 共享模块，路由和定时任务都可读写。
 * 使用文件持久化，PM2 重启也不丢失。
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface OverviewModule {
  label: string;
  icon: string;
  content: string;
}

interface CacheData {
  modules: OverviewModule[];
  questions: string[];
  ts: number;
}

const CACHE_DIR = join(process.cwd(), '.next', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'overview.json');

function ensureDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function getCache(): CacheData | null {
  try {
    if (existsSync(CACHE_FILE)) {
      const raw = readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw) as CacheData;
      // 缓存 24 小时有效
      if (Date.now() - data.ts < 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch {
    // 文件损坏或不存在
  }
  return null;
}

export function setCache(data: Omit<CacheData, 'ts'>): CacheData {
  const full: CacheData = { ...data, ts: Date.now() };
  try {
    ensureDir();
    writeFileSync(CACHE_FILE, JSON.stringify(full), 'utf-8');
  } catch {
    // 写入失败不影响运行，至少内存中还有
  }
  return full;
}
