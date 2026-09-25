import { loadTestEnv } from './test-env';

/**
 * The live test files reset CRM data on the Neon `test` branch, so the whole run holds
 * the live-run lease (issue 12): a concurrent `pnpm eval` fails loudly instead of losing
 * its Assessment Session rows to one of our resets, and vice versa.
 *
 * Every run then starts from a full reset of the seeded scenarios, like `pnpm eval`, so
 * leftover rows from dev use or an earlier run cannot fail a test. The reset refuses any
 * branch not marked as the eval target, so it can only ever wipe the `test` branch.
 */
export default async function setup() {
  const postgresUrl = loadTestEnv().POSTGRES_URL ?? process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error('pnpm test needs POSTGRES_URL for the Neon `test` branch (set it in .env.test.local).');
  }
  process.env.POSTGRES_URL = postgresUrl;
  const { acquireLiveRunLease } = await import('@/lib/db/live-run-lease');
  const lease = await acquireLiveRunLease({ holder: `pnpm test (pid ${process.pid})` });
  try {
    const { requireEvalTarget, seedDemoData } = await import('@/lib/db/seed');
    await requireEvalTarget();
    await seedDemoData({ fullReset: true });
  } catch (error) {
    await lease.release();
    throw error;
  }
  return async () => {
    await lease.release();
  };
}
