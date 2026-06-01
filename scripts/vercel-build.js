const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const schemaMain = path.join(root, 'prisma', 'schema.prisma');
const schemaPg = path.join(root, 'prisma', 'schema.pg.prisma');
const schemaBackup = path.join(root, 'prisma', 'schema.sqlite.bak');
const envFile = path.join(root, '.env');
const envBak = path.join(root, '.env.build.bak');

// 1. Backup SQLite schema
fs.copyFileSync(schemaMain, schemaBackup);

// 2. Switch to PostgreSQL schema
fs.copyFileSync(schemaPg, schemaMain);
console.log('[vercel-build] Switched to PostgreSQL schema');

// 3. Backup .env and set PG DATABASE_URL
if (fs.existsSync(envFile)) {
  fs.copyFileSync(envFile, envBak);
  fs.unlinkSync(envFile);
  console.log('[vercel-build] Backed up .env');
}
process.env.DATABASE_URL = 'postgresql://localhost:5432/dummy';

try {
  // 4. Generate Prisma Client
  execSync('npx prisma generate', { stdio: 'inherit', cwd: root, env: { ...process.env } });
  console.log('[vercel-build] Prisma client generated');

  // 5. Build Next.js
  execSync('npx next build', { stdio: 'inherit', cwd: root, env: { ...process.env } });
  console.log('[vercel-build] Build complete');
} finally {
  // 6. Restore
  fs.copyFileSync(schemaBackup, schemaMain);
  fs.unlinkSync(schemaBackup);
  if (fs.existsSync(envBak)) {
    fs.copyFileSync(envBak, envFile);
    fs.unlinkSync(envBak);
    console.log('[vercel-build] Restored .env');
  }
}
