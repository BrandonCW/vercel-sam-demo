import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Issue 16: the browser reaches the agent through useEveAgent (same-origin /eve/v1) only.
// The server-to-server bridge (/api/qualification/*, lib/eve-session.ts, EVE_AGENT_ORIGIN and
// the deployment-protection bypass it needed) is gone and must not come back.
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['lib', 'agent', 'app', 'components', 'evals'].map((dir) => path.join(ROOT, dir));
const BRIDGE_TERMS = /api\/qualification|eve-session|EVE_AGENT_ORIGIN|getEveAgentOrigin|VERCEL_AUTOMATION_BYPASS_SECRET|x-vercel-protection-bypass/;

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('the agent is reached only through eve', () => {
  it('has no /api/qualification routes and no server-side eve bridge', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/api/qualification'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'lib/eve-session.ts'))).toBe(false);
  });

  it('no source refers to the bridge, its origin setting or the protection bypass', () => {
    const offenders = SOURCE_DIRS.flatMap(sourceFiles).filter((file) => BRIDGE_TERMS.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no app or component code opens a server-side eve client', () => {
    const offenders = ['app', 'components'].map((dir) => path.join(ROOT, dir)).flatMap(sourceFiles).filter((file) => /from ['"]eve\/client['"]/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('documents neither the bridge setting nor the bypass secret', () => {
    for (const doc of ['.env.example', 'README.md']) {
      expect(fs.readFileSync(path.join(ROOT, doc), 'utf8')).not.toMatch(BRIDGE_TERMS);
    }
  });
});
