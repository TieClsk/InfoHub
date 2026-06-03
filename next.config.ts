import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-cron 是纯 Node.js 包，不让 Next.js 打包
  serverExternalPackages: ['node-cron'],
};

export default nextConfig;
