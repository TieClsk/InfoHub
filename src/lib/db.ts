import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  // prisma+postgres:// 协议用于 Accelerate，提取实际 PG 连接或使用适配器
  if (url.startsWith('prisma+postgres://')) {
    // 使用 accelerateUrl 模式（Prisma Dev 本地开发）
    return new PrismaClient({
      accelerateUrl: url,
    });
  }

  // 标准 PostgreSQL 连接字符串 — 使用 pg 适配器
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
