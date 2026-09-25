import fs from 'fs';
import { parseEnv } from 'util';

/** The gitignored `.env.test.local` (Neon `test` branch, Gateway key) as a plain object, or {} if absent. */
export function loadTestEnv(): Record<string, string> {
  return fs.existsSync('.env.test.local') ? (parseEnv(fs.readFileSync('.env.test.local', 'utf8')) as Record<string, string>) : {};
}
