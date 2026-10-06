import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// Spec 9: the scan is off unless it passed — the switch the app reads (scan-settings.json) must say what the test
// report says, and a scan that is on must have its model file in the app.
const ROOT = new URL('../', import.meta.url);
const settings = JSON.parse(readFileSync(new URL('content/model/scan-settings.json', ROOT), 'utf8'));
const report = readFileSync(new URL('reports/scan-test.md', ROOT), 'utf8');

describe('the scan switch follows the test report', () => {
  it('is on exactly when the report chose a model', () => {
    expect(settings.passed).toBe(/passes and is the best phone-sized model/.test(report));
  });
  it('when on, names a model file that ships with the app, its preparation and thresholds', () => {
    if (!settings.passed) return;
    expect(existsSync(new URL(`public/${settings.file}`, ROOT))).toBe(true);
    expect(settings.thresholds.safety).toBeGreaterThan(0); // never "every dangerous species on every scan"
    expect(['squash', 'square', 'timm']).toContain(settings.fit);
    expect(settings.record.dangerOnList).toBeGreaterThanOrEqual(0.98);
  });
});
