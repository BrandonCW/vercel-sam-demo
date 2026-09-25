/**
 * Idempotent demo seed: `pnpm db:seed [--full-reset] [--eval-target]`.
 * Targets whatever POSTGRES_URL is set (never printed). See README "Database".
 *   --full-reset   delete every Opportunity and interaction before restoring the scenarios
 *   --eval-target  also mark this Neon branch as the one `eve eval` may reset (test branch only)
 */
import { markEvalTarget, seedDemoData } from '@/lib/db/seed';
import { getScenarios, listOpportunities } from '@/lib/db/crm';

async function main() {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((a) => a !== '--full-reset' && a !== '--eval-target');
  if (unknown.length > 0) throw new Error(`Unknown option(s): ${unknown.join(' ')}`);

  await seedDemoData({ fullReset: args.has('--full-reset') });
  if (args.has('--eval-target')) console.log(`Marked Neon branch ${await markEvalTarget()} as the eval target.`);
  const [scenarios, opportunities] = await Promise.all([getScenarios(), listOpportunities()]);
  console.log(
    `Seeded ${scenarios.length} scenarios; ${opportunities.length} opportunities: ` +
      opportunities.map((o) => `${o.id} (${o.qualification_status})`).join(', ')
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
