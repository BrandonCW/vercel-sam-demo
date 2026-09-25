import { describe, it, expect, afterEach } from 'vitest';
import { eveClientHeaders } from '@/lib/eve-session';

// Vercel Authentication (Deployment Protection) guards every *.vercel.app deployment URL,
// including the one a deployment's own routes call for /eve/v1.
describe('eve client headers', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('forwards the session cookie locally without a bypass header', () => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    expect(eveClientHeaders('deal_qual_session=abc')).toEqual({ cookie: 'deal_qual_session=abc' });
    expect(eveClientHeaders(null)).toEqual({});
  });

  it('sends the Protection Bypass for Automation header when the secret is set', () => {
    process.env.VERCEL = '1';
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'bypass-secret';
    expect(eveClientHeaders('c=1')).toEqual({ cookie: 'c=1', 'x-vercel-protection-bypass': 'bypass-secret' });
  });

  it('fails loudly on Vercel when no bypass secret is configured', () => {
    process.env.VERCEL = '1';
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    expect(() => eveClientHeaders('c=1')).toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET/);
  });
});
