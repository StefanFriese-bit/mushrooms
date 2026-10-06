import type { Fit } from './prepare';

export type ModelFile = { file: string; label: string; size: number; fit: Fit };

/** The scan models the app can download from public/models/ (ONNX, made by tools/scan-test/export_onnx.py; the 8-bit
 * copies failed the scan test, so the scan's model ships at full size),
 * smallest first, each with the way the scan test prepared its photos. CC BY-NC 4.0, BVRA (Danish Fungi 2020) —
 * credited on the About page. */
export const MODEL_FILES: ModelFile[] = [
  { file: 'models/mobilenetv2-df20-299.fp32.onnx', label: "MobileNetV2 (the scan's model)", size: 299, fit: 'square' },
];
