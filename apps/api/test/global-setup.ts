import { execSync } from 'child_process';

export default async function () {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://spendwise:spendwise@localhost:5433/spendwise_test?schema=public';
  // Real migrations against the real engine: also proves the migration set applies cleanly.
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
