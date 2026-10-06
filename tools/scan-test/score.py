"""Score every test photo with one model and keep the raw class probabilities (float32, photos x classes).
Usage: score.py <hugging-face id> <input size> [--norm half|imagenet] [--limit N]"""
import argparse, json, pathlib
import numpy as np, timm, torch
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('size', type=int)
ap.add_argument('--norm', choices=['half', 'imagenet'], default='half')  # the model cards use 0.5/0.5
ap.add_argument('--limit', type=int, default=0)
a = ap.parse_args()

index = json.loads((ROOT / 'cache/test-photos/index.json').read_text())
files = [f for o in index for f in o['files']][: a.limit or None]
mean, std = ((0.5,) * 3, (0.5,) * 3) if a.norm == 'half' else ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = timm.create_model(f'hf-hub:{a.model}', pretrained=True).eval().to(dev)
m = torch.tensor(mean, device=dev).view(1, 3, 1, 1)
s = torch.tensor(std, device=dev).view(1, 3, 1, 1)

def load(rel):
    im = Image.open(ROOT / 'cache/test-photos' / rel).convert('RGB').resize((a.size, a.size), Image.BILINEAR)
    return torch.from_numpy(np.asarray(im, dtype=np.float32) / 255.0).permute(2, 0, 1)

out = np.zeros((len(files), model.num_classes), dtype=np.float32)
with torch.no_grad():
    for i in range(0, len(files), 32):
        x = torch.stack([load(f) for f in files[i : i + 32]]).to(dev)
        out[i : i + len(x)] = torch.softmax(model((x - m) / s), dim=1).float().cpu().numpy()
        if i % 640 == 0:
            print(f'{i + len(x)}/{len(files)}', flush=True)

name = a.model.split('/')[-1] + ('' if a.norm == 'half' else '.imagenet') + (f'.first{a.limit}' if a.limit else '')
dst = ROOT / 'cache/scores'
dst.mkdir(parents=True, exist_ok=True)
out.tofile(dst / f'{name}.f32')
(dst / f'{name}.json').write_text(json.dumps({'model': a.model, 'size': a.size, 'norm': a.norm, 'classes': model.num_classes, 'files': files}))
print('wrote', dst / f'{name}.f32')
