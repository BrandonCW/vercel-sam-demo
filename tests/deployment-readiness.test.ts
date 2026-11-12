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

  it('ships Warm Stone Deal Desk gauge favicon (app/icon.svg) and matching DealDeskLogoMark across TopNavBar and LoginPage', () => {
    const iconPath = path.join(process.cwd(), 'app', 'icon.svg');
    expect(fs.existsSync(iconPath)).toBe(true);

    const svgContent = fs.readFileSync(iconPath, 'utf8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('#F8F8F6');
    expect(svgContent).toContain('#111215');
    expect(svgContent).toContain('#0F52BA');

    const logoComponentPath = path.join(process.cwd(), 'components', 'ui', 'deal-desk-logo.tsx');
    expect(fs.existsSync(logoComponentPath)).toBe(true);
    const logoContent = fs.readFileSync(logoComponentPath, 'utf8');
    expect(logoContent).toContain('data-testid="deal-desk-logo-mark"');
    expect(logoContent).toContain('#F8F8F6');
    expect(logoContent).toContain('#111215');
    expect(logoContent).toContain('#0F52BA');
    expect(logoContent).toContain('M7.5 21.5A9.5 9.5 0 1 1 24.5 21.5');
    expect(logoContent).toContain('M16 18.5L21.5 11.5');

    const topNavContent = fs.readFileSync(
      path.join(process.cwd(), 'components', 'workbench', 'TopNavBar.tsx'),
      'utf8'
    );
    expect(topNavContent).toContain('DealDeskLogoMark');
    expect(topNavContent).not.toContain('Gauge');

    const loginContent = fs.readFileSync(path.join(process.cwd(), 'app', 'login', 'page.tsx'), 'utf8');
    expect(loginContent).toContain('DealDeskLogoMark');
    expect(loginContent).not.toContain('Gauge');
  });
});
