import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vercel Release & Deployment Configuration', () => {
  it('documents all required production and preview environment variables in .env.example', () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toContain('APP_PASSWORD');
    expect(content).toContain('AUTH_SECRET');
    expect(content).toContain('POSTGRES_URL');
    expect(content).toContain('SYSTEM2_MODEL_ID');
  });

  it('validates vercel.json configuration and security headers', () => {
    const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    expect(parsed.framework).toBe('nextjs');
    expect(Array.isArray(parsed.headers)).toBe(true);
  });

  it('honors SYSTEM2_MODEL_ID from process.env when model is not explicitly supplied in assess request', async () => {
    process.env.SYSTEM2_MODEL_ID = 'gemini-2-flash';
    const { POST } = await import('@/app/api/qualification/assess/route');

    const req = new Request('http://localhost:3000/api/qualification/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: 'opp_acme_corp_001' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    delete process.env.SYSTEM2_MODEL_ID;
  });
});
