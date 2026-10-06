#!/usr/bin/env python3
"""Does each end of a page's cap size appear in the sources it cites? A number counts when the source's text has it
in cm (or as mm, ×10) — e.g. "2 to 7cm", "5–10 cm", "up to 20 cm", "6-8 mm" — or as Wild Food UK's "Average Cap
width". A size whose ends appear in none of its sources is printed: read the sources again before keeping it.
Usage: sizecheck.py <slug> ...   (no slug = every page)"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'cache/research'
sys.path.insert(0, str(ROOT / 'tools/research'))
from verify import text_by_url  # noqa: E402


def numbers(text):
    """Every length the text gives, in cm."""
    out = set()
    t = re.sub(r'\s+', ' ', text).replace('–', '-').replace('−', '-').replace('—', '-')
    # "2 - 5(8) cm": an occasional largest size in brackets after the usual range.
    t = re.sub(r'(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)\)\s*(cm|mm)', r'\1 \3 \2 \3', t)
    for m in re.finditer(r'(\d+(?:\.\d+)?)(?:\s*(?:-|to|and)\s*(\d+(?:\.\d+)?))?\s*\+?\s*(cm|centimet|mm|millimet)', t):
        k = 0.1 if m.group(3).startswith('m') else 1.0
        for g in (m.group(1), m.group(2)):
            if g:
                out.add(round(float(g) * k, 2))
    for m in re.finditer(r'Average Cap width \(CM\) (\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?', t):
        out.update(round(float(g), 2) for g in m.groups() if g)
    return out


def main():
    texts = text_by_url()
    paths = [ROOT / f'content/species/{s}.json' for s in sys.argv[1:]] or sorted((ROOT / 'content/species').glob('*.json'))
    bad = 0
    for p in paths:
        r = json.loads(p.read_text())
        cap = r['features']['capCm']
        url = {s['id']: s['url'] for s in r['sources']}
        found = set()
        for i in cap['sources']:
            found |= numbers(texts.get(url.get(i, ''), ''))
        if cap['value'] is None:  # a crust with no set size: nothing to find
            continue
        lo, hi = cap['value']
        missing = [v for v in (lo, hi) if v != 0 and round(float(v), 2) not in found]
        if missing:
            bad += 1
            print(f'{r["slug"]}: cap {lo}–{hi} cm — not found in its sources: {missing}')
    print(f'{len(paths)} pages checked, {bad} to look at')


if __name__ == '__main__':
    main()
