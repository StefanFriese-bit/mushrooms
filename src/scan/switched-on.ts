import { SETTINGS } from './settings';

// The scan stays off until he has seen its test's record once (spec 6.2): the Scan screen shows it, with the button that
// switches the scan on. Identify's photos use the same switch.
const SEEN = 'scan-record-seen';

export function scanSwitchedOn(): boolean {
  if (!SETTINGS.passed) return false;
  try { return localStorage.getItem(SEEN) === SETTINGS.tested; } catch { return false; }
}

export function switchScanOn(): void {
  if (!SETTINGS.passed) return;
  try { localStorage.setItem(SEEN, SETTINGS.tested); } catch { /* not kept: he will see the record again next time */ }
}
