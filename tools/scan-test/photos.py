"""How a photo becomes the model's input: the same steps the app takes in the browser (src/scan/prepare.ts), so the
scan test measures what ships. The photo is turned upright (its camera orientation), cut to a square as `fit` says,
scaled to size x size and returned as red, green and blue planes with values 0-1 (1 x 3 x size x size).
  squash  the whole photo, scaled to a square (a 4:3 photo is squeezed)
  square  the centre square (the shorter side), scaled
  timm    the centre square of 0.875 x the shorter side, scaled (the models' own evaluation crop)"""
import math
import numpy as np
from PIL import Image, ImageOps

FITS = ('squash', 'square', 'timm')


def prepare(path, size, fit='squash'):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    if fit != 'squash':
        w, h = im.size
        side = min(w, h) * (0.875 if fit == 'timm' else 1.0)
        left, top = (w - side) / 2, (h - side) / 2
        near = lambda v: math.floor(v + 0.5)  # rounds as JavaScript's Math.round does, so both cut the same pixels
        im = im.crop((near(left), near(top), near(left + side), near(top + side)))
    im = im.resize((size, size), Image.BILINEAR)
    return (np.asarray(im, dtype=np.float32) / 255.0).transpose(2, 0, 1)[None]
