"""Score every test photo with one model and keep the raw class probabilities (float32, photos x classes).
Usage: score.py <hugging-face id> <input size> [--norm half|imagenet] [--fit squash|square|timm] [--sample K]
                [--onnx <file>]
--sample K scores only every K-th observation of the tuning half (even numbers), for choosing how photos are prepared
without looking at the checking half.
--onnx scores with an exported file (path from the repo root) instead of PyTorch; the file holds its normalisation, so
--norm only records which one it was exported with."""
import argparse, json, pathlib
import numpy as np
from photos import FITS, prepare

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('size', type=int)
ap.add_argument('--norm', choices=['half', 'imagenet'], default='half')  # the cards say 0.5/0.5, their configs ImageNet's
ap.add_argument('--fit', choices=FITS, default='squash')
ap.add_argument('--sample', type=int, default=0)
ap.add_argument('--onnx')
a = ap.parse_args()

index = json.loads((ROOT / 'cache/test-photos/index.json').read_text())
chosen = [o for o in index if o['obsId'] % 2 == 0][:: a.sample] if a.sample else index
files = [f for o in chosen for f in o['files']]


def photo(rel):
    return prepare(ROOT / 'cache/test-photos' / rel, a.size, a.fit)


if a.onnx:
    import onnxruntime as ort
    sess = ort.InferenceSession(str(ROOT / a.onnx), providers=['CPUExecutionProvider'])
    classes = sess.get_outputs()[0].shape[1]
    out = np.zeros((len(files), classes), dtype=np.float32)
    for i, f in enumerate(files):
        out[i] = sess.run(None, {'pixels': photo(f)})[0][0]
        if i % 1000 == 0:
            print(f'{i + 1}/{len(files)}', flush=True)
else:
    import timm, torch
    mean, std = ((0.5,) * 3, (0.5,) * 3) if a.norm == 'half' else ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))
    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    # Transformers are built at the size they were trained at: timm's hub loader otherwise builds BVRA's 384-px ViTs at
    # 224 px and silently shrinks their position grid while loading (checkpoint 577 positions, model 197).
    sized = {'img_size': a.size} if any(t in a.model for t in ('vit_', 'beit_', 'swin_')) else {}
    model = timm.create_model(f'hf-hub:{a.model}', pretrained=True, **sized).eval().to(dev)
    classes = model.num_classes
    m = torch.tensor(mean, device=dev).view(1, 3, 1, 1)
    s = torch.tensor(std, device=dev).view(1, 3, 1, 1)
    out = np.zeros((len(files), classes), dtype=np.float32)
    with torch.no_grad():
        for i in range(0, len(files), 32):
            x = torch.from_numpy(np.concatenate([photo(f) for f in files[i : i + 32]])).to(dev)
            out[i : i + len(x)] = torch.softmax(model((x - m) / s), dim=1).float().cpu().numpy()
            if i % 640 == 0:
                print(f'{i + len(x)}/{len(files)}', flush=True)

name = (a.model.split('/')[-1] + ('' if a.norm == 'half' else '.imagenet') + ('' if a.fit == 'squash' else f'.{a.fit}')
        + (('.int8' if 'int8' in a.onnx else '.phone') if a.onnx else '') + (f'.sample{a.sample}' if a.sample else ''))
dst = ROOT / 'cache/scores'
dst.mkdir(parents=True, exist_ok=True)
out.tofile(dst / f'{name}.f32')
(dst / f'{name}.json').write_text(json.dumps({'model': a.model, 'size': a.size, 'norm': a.norm, 'fit': a.fit,
                                              'onnx': a.onnx, 'classes': int(classes), 'files': files}))
print('wrote', dst / f'{name}.f32', flush=True)
# Leave at once: onnxruntime 1.30's telemetry can crash while Python shuts down (a race between its exit-time
# destructor and its upload thread), which macOS reports as "Python quit unexpectedly". Everything is written.
import os, sys
sys.stdout.flush(); sys.stderr.flush(); os._exit(0)
