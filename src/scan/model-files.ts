import type { Fit } from './prepare';

/** `classes`: which species list the model's outputs follow (content/model/<classes>-classes.json). */
export type ModelFile = { file: string; label: string; size: number; fit: Fit; classes: 'df20' | 'fungitastic' };

/** The scan models the speed test can download from public/models/ (ONNX, made by tools/scan-test/export_onnx.py; the
 * 8-bit copies failed the scan test, so they ship at full size), smallest first, each with the way the scan test
 * prepared its photos. Only the scan's own model is stored on the phone; the others are fetched when their button is
 * pressed. CC BY-NC 4.0, BVRA (Danish Fungi 2020; FungiTastic) — credited on the About page. */
export const MODEL_FILES: ModelFile[] = [
  { file: 'models/mobilenetv2-df20-299.fp32.onnx', label: "MobileNetV2 (the scan's model)", size: 299, fit: 'square', classes: 'df20' },
  { file: 'models/effnet-b3-fungitastic-384.fp32.onnx', label: 'FungiTastic EfficientNet-B3 (a candidate: 2,829 species)', size: 384,
    fit: 'square', classes: 'fungitastic' },
];
