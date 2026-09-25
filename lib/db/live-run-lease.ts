import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import { getPostgresUrl } from '@/lib/env';

/**
 * A lease in Postgres that serialises the destructive users of the Neon `test`
 * branch: `pnpm eval` and the live vitest files both reset CRM data, and a reset
 * deletes the rows of any Assessment Session in flight (issue 12: the "did not
 * persist a run_system2_analysis result" flake). Whoever runs second fails loudly
 * instead of silently corrupting the other run.
 *
 * The holder renews the lease every third of its TTL while it runs, so a long run
 * keeps it; a crashed run stops renewing and its lease can be taken over after the
 * TTL. All times are the database clock. The table is part of `db/schema.sql`.
 */
export const LIVE_RUN_LEASE_NAME = 'neon-test-branch';
const DEFAULT_TTL_MS = 5 * 60_000;

export interface LiveRunLease {
  release: () => Promise<void>;
}

export async function acquireLiveRunLease(input: {
  holder: string;
  ttlMs?: number;
  /** Lease name; only tests of this module use another name. */
  name?: string;
}): Promise<LiveRunLease> {
  const sql = neon(getPostgresUrl());
  const name = input.name ?? LIVE_RUN_LEASE_NAME;
  const ttlSeconds = (input.ttlMs ?? DEFAULT_TTL_MS) / 1_000;
  const token = randomUUID();
  const taken = await sql`
    INSERT INTO live_run_lease (name, holder, token, expires_at)
    VALUES (${name}, ${input.holder}, ${token}, NOW() + make_interval(secs => ${ttlSeconds}))
    ON CONFLICT (name) DO UPDATE SET holder = EXCLUDED.holder, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
    WHERE live_run_lease.expires_at < NOW()
    RETURNING token;`.catch((error: Error) => {
    throw new Error(`Could not take the live-run lease (${error.message}). Apply db/schema.sql with \`pnpm db:seed\`.`);
  });
  if (taken.length === 0) {
    const [current] = await sql`SELECT holder, expires_at FROM live_run_lease WHERE name = ${name};`;
    throw new Error(
      `The test database is busy: its live-run lease '${name}' is held by ${current?.holder ?? 'another run'} until ` +
        `${current ? new Date(current.expires_at).toISOString() : 'unknown'}. Wait for that run to finish; running ` +
        `both at once lets one reset the other's Assessment Sessions mid-turn.`
    );
  }

  const renew = setInterval(async () => {
    const kept = await sql`
      UPDATE live_run_lease SET expires_at = NOW() + make_interval(secs => ${ttlSeconds})
      WHERE name = ${name} AND token = ${token} RETURNING token;`.catch(() => []);
    if (kept.length === 0) {
      console.error(`[live-run-lease] Lost the '${name}' lease held by ${input.holder}; another run may now reset the test database.`);
    }
  }, (ttlSeconds * 1_000) / 3);
  renew.unref?.();

  return {
    release: async () => {
      clearInterval(renew);
      await sql`DELETE FROM live_run_lease WHERE name = ${name} AND token = ${token};`;
    },
  };
}
