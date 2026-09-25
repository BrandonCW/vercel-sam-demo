import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Fixtures are for unit tests of pure logic only: runtime code (lib/, agent/, app/,
// components/) and the live evals must never import anything under tests/fixtures/.
const RUNTIME_DIRS = ['lib', 'agent', 'app', 'components', 'evals'];
const FIXTURE_IMPORT = /from\s+['"][^'"]*tests\/fixtures|from\s+['"]\.\.?\/(?:\.\.\/)*fixtures\//;

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('fixture boundary', () => {
  it('no runtime or eval module imports tests/fixtures', () => {
    const offenders = RUNTIME_DIRS.flatMap(sourceFiles).filter((file) =>
      FIXTURE_IMPORT.test(fs.readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('the guard detects a fixture import', () => {
    expect(FIXTURE_IMPORT.test(`import { jev } from '@/tests/fixtures/qualification';`)).toBe(true);
    expect(FIXTURE_IMPORT.test(`import { jev } from '../../tests/fixtures/qualification';`)).toBe(true);
  });
});
