import raw from '../../content/model/scan-settings.json';
import type { Fit } from './prepare';
import type { Thresholds } from './rules';

// What the scan test decided (tools/evaluate-scan.ts writes the file): which model file, how photos are prepared, the
// two thresholds, and the measured record — or that the scan stays off (spec 6.3). Never set by hand.
export type MeasuredRecord = { rightFirst: number; onList: number; dangerOnList: number; observations: number;
  /** The group headline: right when shown. The right species still on the list when the scan says "not sure". */
  groupRight: number; onListNotSure: number };
export type ScanSettings =
  | { passed: true; model: string; file: string; size: number; norm: string; fit: Fit; thresholds: Thresholds; record: MeasuredRecord; tested: string }
  | { passed: false; reason: string; tested: string };

export const SETTINGS = raw as unknown as ScanSettings;
export const REPORT_URL = 'https://github.com/StefanFriese-bit/mushrooms/blob/main/reports/scan-test.md';
