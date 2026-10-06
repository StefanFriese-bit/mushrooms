"""Export one model for the browser: pixels 0-1 (1x3xSxS, float32) in, probabilities out (normalisation and softmax
inside), checked against PyTorch; then an 8-bit copy calibrated on test photos from the tuning half (even observation
numbers). The 32-bit file stays in cache/onnx/; the 8-bit one goes to public/models/.
Usage: export_onnx.py <hugging-face id> <size> <short name> [--norm half|imagenet] [--fit squash|square|timm]
                      [--calibrate N] [--skip-int8]
The calibration photos are prepared as the app prepares a photo (photos.py), with the --fit the test chose."""
import argparse, json, pathlib
import numpy as np, onnxruntime as ort, timm, torch
from photos import FITS, prepare

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('size', type=int); ap.add_argument('name')
ap.add_argument('--norm', choices=['half', 'imagenet'], default='half')
ap.add_argument('--fit', choices=FITS, default='squash')
ap.add_argument('--calibrate', type=int, default=200)
ap.add_argument('--skip-int8', action='store_true')
a = ap.parse_args()
mean, std = ((0.5,) * 3, (0.5,) * 3) if a.norm == 'half' else ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))


class ForTheBrowser(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.register_buffer('mean', torch.tensor(mean).view(1, 3, 1, 1))
        self.register_buffer('std', torch.tensor(std).view(1, 3, 1, 1))

    def forward(self, pixels):
        return torch.softmax(self.model((pixels - self.mean) / self.std), dim=1)


net = ForTheBrowser(timm.create_model(f'hf-hub:{a.model}', pretrained=True).eval()).eval()
fp32 = ROOT / 'cache/onnx' / f'{a.name}.fp32.onnx'
fp32.parent.mkdir(parents=True, exist_ok=True)
dummy = torch.rand(1, 3, a.size, a.size)
try:
    torch.onnx.export(net, (dummy,), str(fp32), input_names=['pixels'], output_names=['probabilities'], opset_version=18, dynamo=True)
except Exception as err:  # the older exporter, if the new one cannot handle this model
    print('dynamo export failed, using the TorchScript exporter:', str(err)[:200])
    torch.onnx.export(net, (dummy,), str(fp32), input_names=['pixels'], output_names=['probabilities'], opset_version=17, dynamo=False)

# One self-contained file for the browser: the new exporter puts the weights in a side file (.data).
import onnx
whole = onnx.load(str(fp32), load_external_data=True)
side = fp32.with_name(fp32.name + '.data')
onnx.save(whole, str(fp32), save_as_external_data=False)
side.unlink(missing_ok=True)

sess = ort.InferenceSession(str(fp32), providers=['CPUExecutionProvider'])
worst = 0.0
with torch.no_grad():
    for _ in range(10):
        x = torch.rand(1, 3, a.size, a.size)
        worst = max(worst, float(np.abs(net(x).numpy() - sess.run(None, {'pixels': x.numpy()})[0]).max()))
print(f'{fp32.name}: {fp32.stat().st_size / 1e6:.1f} MB, largest difference from PyTorch {worst:.2e}')
if worst > 1e-4:
    raise SystemExit('the exported model does not match PyTorch')
if a.skip_int8:
    raise SystemExit(0)

from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
from onnxruntime.quantization.shape_inference import quant_pre_process

index = json.loads((ROOT / 'cache/test-photos/index.json').read_text())
calib = [o['files'][0] for o in index if o['obsId'] % 2 == 0][:: max(1, len(index) // (2 * a.calibrate))][: a.calibrate]


def load(rel):
    return prepare(ROOT / 'cache/test-photos' / rel, a.size, a.fit)


class Photos(CalibrationDataReader):
    def __init__(self):
        self.it = iter(calib)

    def get_next(self):
        f = next(self.it, None)
        return None if f is None else {'pixels': load(f)}


pre = ROOT / 'cache/onnx' / f'{a.name}.pre.onnx'
quant_pre_process(str(fp32), str(pre))
int8 = ROOT / 'public/models' / f'{a.name}.int8.onnx'
int8.parent.mkdir(parents=True, exist_ok=True)
quantize_static(str(pre), str(int8), Photos(), quant_format=QuantFormat.QDQ, per_channel=True,
                activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8)
print(f'{int8.name}: {int8.stat().st_size / 1e6:.1f} MB (8-bit, calibrated on {len(calib)} tuning photos)')
