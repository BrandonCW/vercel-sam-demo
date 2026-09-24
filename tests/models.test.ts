import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SYSTEM2_MODELS, DEFAULT_SYSTEM2_MODEL, resolveAgentModel } from '@/lib/models';

const RETIRED = /claude-3[-.]5|gpt-4o-mini|gemini-2(\.0)?-flash|Claude 3\.5|GPT-4o-mini|Gemini 2\.0/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('System 2 model configuration', () => {
  it('offers current Vercel AI Gateway model IDs, defaulting to Claude Sonnet 5', () => {
    expect(DEFAULT_SYSTEM2_MODEL).toBe('anthropic/claude-sonnet-5');
    expect(SYSTEM2_MODELS.map((m) => m.id)).toEqual([
      'anthropic/claude-sonnet-5',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-5.5',
      'google/gemini-3.5-flash',
    ]);
  });

  it('uses the default when SYSTEM2_MODEL_ID is unset and honours a supported override', () => {
    expect(resolveAgentModel({})).toBe('anthropic/claude-sonnet-5');
    expect(resolveAgentModel({ SYSTEM2_MODEL_ID: 'openai/gpt-5.5' })).toBe('openai/gpt-5.5');
  });

  it('rejects a retired or unknown SYSTEM2_MODEL_ID instead of silently using it', () => {
    expect(() => resolveAgentModel({ SYSTEM2_MODEL_ID: 'claude-3-5-sonnet' })).toThrow(/SYSTEM2_MODEL_ID/);
  });

  it('leaves no retired model IDs in agent/, lib/, .env.example or the spec', () => {
    const files = [
      ...walk('agent'),
      ...walk('lib'),
      ...walk('components'),
      ...walk('app'),
      '.env.example',
      '.scratch/deal-qualification/spec.md',
    ];
    const offenders = files.filter((f) => {
      const text = fs.readFileSync(f, 'utf8');
      // The spec's amendment log may name the retired options it replaced.
      const body = f.endsWith('spec.md') ? text.split('## Amendments')[0] : text;
      return RETIRED.test(body);
    });
    expect(offenders).toEqual([]);
  });
});
