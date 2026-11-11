import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { nextConfig } from '../next.config';

describe('Vercel Release & Deployment Configuration', () => {
  it('documents all required production and preview environment variables in .env.example', () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toContain('APP_PASSWORD');
    expect(content).toContain('AUTH_SECRET');
    expect(content).toContain('POSTGRES_URL');
    expect(content).toContain('SYSTEM2_MODEL_ID');
    expect(content).toContain('AI_GATEWAY_API_KEY');
  });

  it('documents required variables as required, with no offline or in-memory fallback', () => {
    const content = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
    expect(content).not.toMatch(/fall(s)?[ -]?back|in-memory|optional/i);
    for (const name of ['AI_GATEWAY_API_KEY', 'POSTGRES_URL', 'APP_PASSWORD', 'AUTH_SECRET']) {
      expect(content).toMatch(new RegExp(`\\(required[^)]*\\)[^\\n]*\\n(#[^\\n]*\\n)*${name}=`, 'i'));
    }
  });

  it('validates vercel.json configuration and security headers', () => {
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    expect(parsed.framework).toBe('nextjs');
    expect(Array.isArray(parsed.headers)).toBe(true);
    expect(parsed.headers.length).toBeGreaterThan(0);
  });

  it('exports runtime security headers in next.config.ts matching vercel.json', async () => {
    const vercelParsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
    const vercelHeaders = vercelParsed.headers[0].headers;

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(typeof nextConfig.headers).toBe('function');

    const runtimeHeaderRules = await nextConfig.headers!();
    expect(runtimeHeaderRules).toEqual([
      {
        source: '/:path*',
        headers: vercelHeaders,
      },
    ]);
  });
});
