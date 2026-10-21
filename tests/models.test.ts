import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SYSTEM2_MODELS,
  DEFAULT_AGENT_MODEL,
  DEFAULT_SYSTEM2_MODEL,
  resolveAgentModel,
  resolveSystem2Model,
  resolveJevModel,
} from '@/lib/models';

const RETIRED = /claude-3[-.]5|gpt-4o-mini|gemini-2(\.0)?-flash|Claude 3\.5|GPT-4o-mini|Gemini 2\.0/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe('System 2 model configuration', () => {
  it('offers current Vercel AI Gateway model IDs: Gemini 3.8 Flash default and Claude Haiku 5.5 fast', () => {
    expect(SYSTEM2_MODELS.map((m) => m.id)).toEqual([
      'google/gemini-3.8-flash',
      'anthropic/claude-haiku-5.5',
    ]);
    expect(SYSTEM2_MODELS.find((m) => m.id === DEFAULT_SYSTEM2_MODEL)?.badge).toBe('Default');
  });

  // With run_assessment sequencing the session in code, Gemini 3.8 Flash called it and returned the
  // structured outcome in 5/5 live sessions (issue 19).
  it('runs the root agent on Gemini 3.8 Flash unless AGENT_MODEL_ID overrides it (issue 19)', () => {
    expect(DEFAULT_AGENT_MODEL).toBe('google/gemini-3.8-flash');
    expect(resolveAgentModel({})).toBe('google/gemini-3.8-flash');
    expect(resolveAgentModel({ SYSTEM2_MODEL_ID: 'anthropic/claude-haiku-5.5' })).toBe('google/gemini-3.8-flash');
    expect(resolveAgentModel({ AGENT_MODEL_ID: 'anthropic/claude-haiku-5.5' })).toBe('anthropic/claude-haiku-5.5');
  });

  // System 2 defaults to a fast Gemini Flash model with schema-constrained output.
  it('defaults System 2 to Gemini 3.8 Flash unless SYSTEM2_MODEL_ID overrides it', () => {
    expect(DEFAULT_SYSTEM2_MODEL).toBe('google/gemini-3.8-flash');
    expect(resolveSystem2Model({})).toBe('google/gemini-3.8-flash');
    expect(resolveSystem2Model({ SYSTEM2_MODEL_ID: 'anthropic/claude-haiku-5.5' })).toBe('anthropic/claude-haiku-5.5');
  });

  it('rejects a retired or unknown model override instead of silently using it', () => {
    expect(() => resolveSystem2Model({ SYSTEM2_MODEL_ID: 'claude-3-5-sonnet' })).toThrow(/Unknown System 2 model: claude-3-5-sonnet.*SYSTEM2_MODEL_ID/);
    expect(() => resolveSystem2Model('unknown-model')).toThrow(/Unknown System 2 model: unknown-model/);
    expect(() => resolveAgentModel({ AGENT_MODEL_ID: 'claude-3-5-sonnet' })).toThrow(/AGENT_MODEL_ID/);
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

describe('resolveJevModel', () => {
  it('is typesafe-ai/jev unless JEV_MODEL_ID overrides it', () => {
    expect(resolveJevModel({})).toBe('typesafe-ai/jev');
    expect(resolveJevModel({ JEV_MODEL_ID: '  ' })).toBe('typesafe-ai/jev');
    expect(resolveJevModel({ JEV_MODEL_ID: 'typesafe-ai/jev-nonexistent' })).toBe('typesafe-ai/jev-nonexistent');
  });

  it('rejects a JEV_MODEL_ID that is not a provider/model Gateway ID', () => {
    expect(() => resolveJevModel({ JEV_MODEL_ID: 'jev' })).toThrow(/JEV_MODEL_ID/);
  });
});
