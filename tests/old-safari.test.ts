import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The app must start on older iPhones (Safari 14+). The build rewrites newer JavaScript, but it cannot rewrite a
// regular-expression look-behind — Safari before iOS 16.4 refuses the whole file, and the app never starts.
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
});

describe('older iPhones can start the app', () => {
  it('no app code uses a regular-expression look-behind', () => {
    const offenders = files(SRC).filter((f) => /\(\?<[!=]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
