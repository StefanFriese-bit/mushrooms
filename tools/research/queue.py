#!/usr/bin/env python3
"""The batch-2 species still without a page, in list order, with how many sites were gathered for each.
Usage: queue.py [N]   (the next N with at least two sites; 'weak' lists those with fewer; HELD are skipped)"""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'cache/research'
lst = json.loads((ROOT / 'content/species-list.json').read_text())['species']
have = {json.loads(p.read_text())['scientific'] for p in (ROOT / 'content/species').glob('*.json')}
b1 = [s for s in lst if 'edible' in (s.get('reasons') or []) or s.get('dangerLevel')]
slug = lambda n: re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
# Held back: no trusted site gives what a page must have (each one is named in the batch report).
HELD = {'Chlorociboria aeruginascens',  # Green Elfcup: no edibility on any trusted site
        'Kretzschmaria deusta'}  # Brittle Cinder: no size on any trusted site
rows = []
for s in lst:
    if s in b1 or s['name'] in have or s['name'] in HELD:
        continue
    p = R / f"{slug(s['english'] or s['name'])}.txt"
    t = p.read_text() if p.exists() else ''
    sites = [tag for tag in ('fn', 'wf', 'wp', 'wt') if re.search(rf'^\[{tag}\] https?://', t, re.M)]
    rows.append((p.stem, s['name'], sites))
arg = sys.argv[1] if len(sys.argv) > 1 else '6'
if arg == 'weak':
    for r in rows:
        if len(r[2]) < 2: print(*r)
else:
    print(len(rows), 'left;', sum(len(r[2]) >= 2 for r in rows), 'with two or more sites')
    for r in [r for r in rows if len(r[2]) >= 2][:int(arg)]:
        print(*r)
