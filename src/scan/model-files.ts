import type { Fit } from './prepare';

export type ModelFile = { file: string; label: string; size: number; fit: Fit };

/** The scan models the app can download from public/models/ (8-bit ONNX, made by tools/scan-test/export_onnx.py),
 * smallest first, each with the way the scan test prepared its photos. CC BY-NC 4.0, BVRA (Danish Fungi 2020) —
 * credited on the About page. */
export const MODEL_FILES: ModelFile[] = [
  // filled in when the 8-bit files are made (plan 2d-1, task 7); until then the speed test is not linked
];
