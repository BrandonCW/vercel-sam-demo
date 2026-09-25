import { describe, it, expect, afterEach } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { acquireLiveRunLease } from '@/lib/db/live-run-lease';

// Live against the Neon `test` branch. Uses its own lease name so it never contends with the
// suite-wide lease the vitest global setup holds.
const NAME = 'lease-unit-test';

/** What a run that crashed without releasing leaves behind: an expired lease row it no longer renews. */
async function leaveExpiredLease(token = 'crashed-token') {
  await neon(process.env.POSTGRES_URL!)`
    INSERT INTO live_run_lease (name, holder, token, expires_at) VALUES (${NAME}, 'crashed run', ${token}, NOW() - interval '1 second')
    ON CONFLICT (name) DO UPDATE SET holder = EXCLUDED.holder, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at;`;
}

describe('live-run lease (serialises destructive users of the test database)', { timeout: 30_000 }, () => {
  const held: { release: () => Promise<void> }[] = [];
  afterEach(async () => {
    while (held.length) await held.pop()!.release();
  });

  it('refuses a second holder while the first holds the lease, naming the holder', async () => {
    held.push(await acquireLiveRunLease({ holder: 'pnpm eval', ttlMs: 60_000, name: NAME }));
    await expect(acquireLiveRunLease({ holder: 'pnpm test', ttlMs: 60_000, name: NAME })).rejects.toThrow(
      /held by pnpm eval until/
    );
  });

  it('can be taken again once released', async () => {
    const first = await acquireLiveRunLease({ holder: 'pnpm eval', ttlMs: 60_000, name: NAME });
    await first.release();
    held.push(await acquireLiveRunLease({ holder: 'pnpm test', ttlMs: 60_000, name: NAME }));
  });

  it('can be taken over once the previous holder expired (a crashed run)', async () => {
    await leaveExpiredLease();
    held.push(await acquireLiveRunLease({ holder: 'pnpm test', ttlMs: 60_000, name: NAME }));
  });

  it('a slow holder releasing late does not drop the lease someone else took over', async () => {
    const slow = await acquireLiveRunLease({ holder: 'slow run', ttlMs: 60_000, name: NAME });
    await slow.release(); // stop its renewals, then simulate its lease having expired while it still thought it held it
    await leaveExpiredLease();
    held.push(await acquireLiveRunLease({ holder: 'pnpm test', ttlMs: 60_000, name: NAME }));
    await slow.release();
    await expect(acquireLiveRunLease({ holder: 'pnpm eval', ttlMs: 60_000, name: NAME })).rejects.toThrow(/held by pnpm test/);
  });
});
