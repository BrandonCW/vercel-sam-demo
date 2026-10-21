#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { parseEnv } from 'util';
import {
  scoreWithJev,
  saveJevScoring,
  analyzeWithSystem2,
  recordFeedback,
  writeBack,
} from '@/agent/lib/assessment-steps';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';
import { DEFAULT_SYSTEM2_MODEL } from '@/lib/models';
import { SimulationFixtureSchema, type SimulationFixture } from '@/lib/simulation/fixture-schema';
import type { AssessmentScope } from '@/lib/assessment-session';

function loadLocalEnv() {
  const envFiles = ['.env.local', '.env.test.local'];
  const searchDirs = [process.cwd()];

  try {
    const gitDir = require('child_process')
      .execSync('git rev-parse --git-common-dir', { encoding: 'utf8' })
      .trim();
    if (gitDir) {
      searchDirs.push(path.resolve(gitDir, '..'));
    }
  } catch {
    // Ignore git error
  }

  for (const dir of searchDirs) {
    for (const envFile of envFiles) {
      const fullPath = path.resolve(dir, envFile);
      if (fs.existsSync(fullPath)) {
        try {
          const parsed = parseEnv(fs.readFileSync(fullPath, 'utf8'));
          for (const [key, val] of Object.entries(parsed)) {
            if (!process.env[key] && typeof val === 'string') {
              process.env[key] = val;
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}

async function captureSimulationFixture() {
  loadLocalEnv();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`\nUsage: npx tsx scripts/capture-simulation-fixture.ts [opportunityId]`);
    console.log(`\nCaptures live System 1 and System 2 outputs from Vercel AI Gateway`);
    console.log(`and writes a simulation fixture JSON file to lib/fixtures/simulation/.\n`);
    console.log(`Options:`);
    console.log(`  opportunityId   CRM opportunity ID (defaults to 'opp_acme_corp_001')`);
    console.log(`  -h, --help      Show this help message\n`);
    process.exit(0);
  }

  const opportunityId = process.argv[2] || 'opp_acme_corp_001';
  const outFileName = opportunityId === 'opp_acme_corp_001' ? 'acme_migration.json' : `${opportunityId}.json`;
  const outPath = path.resolve(process.cwd(), 'lib/fixtures/simulation', outFileName);

  console.log(`\n======================================================`);
  console.log(`   Simulation Fixture Capture Tool`);
  console.log(`   Target Opportunity: ${opportunityId}`);
  console.log(`   Output File:        ${outPath}`);
  console.log(`======================================================\n`);

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error(`❌ Error: AI_GATEWAY_API_KEY environment variable is not configured.`);
    console.error(`   Please set AI_GATEWAY_API_KEY in your environment or in .env.local.`);
    console.error(`   Example: AI_GATEWAY_API_KEY=vck_... npx tsx scripts/capture-simulation-fixture.ts\n`);
    process.exit(1);
  }

  if (!process.env.POSTGRES_URL) {
    console.error(`❌ Error: POSTGRES_URL environment variable is not configured.`);
    console.error(`   Please set POSTGRES_URL in your environment or in .env.local.`);
    console.error(`   Example: POSTGRES_URL=postgresql://... npx tsx scripts/capture-simulation-fixture.ts\n`);
    process.exit(1);
  }

  const scope: AssessmentScope = {
    sessionId: `capture_${Date.now()}`,
    turnId: `turn_1`,
  };

  try {
    // 1. System 1 Baseline Jev Scoring
    console.log(`[1/4] Running System 1 Jev Scoring for ${opportunityId}...`);
    const { opportunity: baselineOpp, jevResult: baselineJev } = await scoreWithJev(opportunityId);
    console.log(`      Baseline Composite Score: ${baselineJev.overallScore}/100`);
    console.log(`      Stage Gate 2 Ready:       ${baselineJev.stageGate.gateReady}`);
    await saveJevScoring(baselineOpp, baselineJev, scope);

    // 2. System 2 Reasoning & Discovery Form
    console.log(`[2/4] Running System 2 analysis with model ${DEFAULT_SYSTEM2_MODEL}...`);
    const { system2Result } = await analyzeWithSystem2(
      baselineOpp,
      baselineJev,
      DEFAULT_SYSTEM2_MODEL,
      scope
    );
    console.log(`      Discovery Form Sections:  ${system2Result.phase3Form.sections.length}`);
    const totalFields = system2Result.phase3Form.sections.reduce(
      (acc, s) => acc + s.fields.length,
      0
    );
    console.log(`      Discovery Questions:      ${totalFields}`);

    // 3. Formulate standard answers & Delta Re-scoring
    console.log(`[3/4] Formulating SA discovery answers & executing delta re-scoring...`);
    const formResponses: Record<string, string | string[]> = {};
    for (const section of system2Result.phase3Form.sections) {
      for (const field of section.fields) {
        if (field.options && field.options.length > 0) {
          formResponses[field.id] = field.options[0].value;
        } else {
          formResponses[field.id] = 'Confirmed via executive interview and architecture review.';
        }
      }
    }

    const notesDelta =
      'Economic Buyer verified: VP Eng Jane Doe confirmed executive sponsorship conditioned on build times < 5m. ' +
      'Technical decision criteria locked: Sub-5 minute builds with Turborepo remote caching and App Router ISR.';

    const feedbackKey = await saFeedbackKey(formResponses, notesDelta);
    await recordFeedback(opportunityId, { formResponses, notesDelta, feedbackKey }, scope);

    // Re-score with Jev after feedback
    const rescoreScope: AssessmentScope = {
      sessionId: scope.sessionId,
      turnId: `turn_2`,
    };
    const { opportunity: rescoreOpp, jevResult: rescoreJevResult } = await scoreWithJev(opportunityId);
    console.log(`      Rescore Composite Score:  ${rescoreJevResult.overallScore}/100`);
    console.log(`      Rescore Stage Gate Ready: ${rescoreJevResult.stageGate.gateReady}`);
    await saveJevScoring(rescoreOpp, rescoreJevResult, rescoreScope);

    // Writeback verdict
    const verdict = await writeBack(opportunityId, rescoreScope, 'recorded');
    console.log(`      Final Qualification:      ${verdict.qualificationStatus}`);
    console.log(`      Score Delta:              +${verdict.delta}`);

    // 4. Assemble and serialize fixture
    console.log(`[4/4] Assembling and validating fixture against schema...`);
    const fixture: SimulationFixture = {
      scenarioId: opportunityId,
      opportunity: baselineOpp,
      baseline: {
        jevResult: baselineJev,
        system2Result,
      },
      feedback: {
        formResponses,
        notesDelta,
        rescoreJevResult,
      },
      verdict,
      capturedAt: new Date().toISOString(),
    };

    const validated = SimulationFixtureSchema.parse(fixture);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(validated, null, 2), 'utf8');

    console.log(`\n✅ Fixture successfully captured and saved to:`);
    console.log(`   ${outPath}\n`);
  } catch (error) {
    console.error(`\n❌ Capture failed with error:`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  captureSimulationFixture();
}
