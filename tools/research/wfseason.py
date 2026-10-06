#!/usr/bin/env python3
"""Read the season (start and end month) and the average cap width that Wild Food UK prints at the top of each species
page, from the page text gather.py kept, into cache/research/wf-season.json. Only a species' OWN Wild Food UK page is
read: an extract whose [wf] line says "no page" is skipped. Usage: wfseason.py [<extract> ...]   (none = every extract)"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'cache/research'
OUT = R / 'wf-season.json'


def read(stem):
    ex = (R / f'{stem}.txt').read_text()
    if not re.search(r'^\[wf\] https?://', ex, re.M):
        return None
    full = R / 'full' / f'{stem}.wf.txt'
    if not full.exists():
        return None
    t = re.sub(r'\s+', ' ', full.read_text())
    season = re.search(r'Season Start (\w+) Season End (\w+)', t)
    height = re.search(r'Average Mushroom height \(CM\) ([\d.]+(?:\s*-\s*[\d.]+)?)', t)
    cap = re.search(r'Average Cap width \(CM\) ([\d.]+(?:\s*-\s*[\d.]+)?)', t)
    if not season:
        return None
    return {'season': [season.group(1), season.group(2)], 'height': height.group(1).replace(' ', '') if height else None,
            'cap': cap.group(1).replace(' ', '') if cap else None}


def main():
    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    stems = sys.argv[1:] or sorted(p.stem for p in R.glob('*.txt') if p.stem != 'notes')
    for stem in stems:
        got = read(stem)
        if got:
            data[stem] = got
        else:
            data.pop(stem, None)
        print(stem, got)
    OUT.write_text(json.dumps(data, indent=1))


if __name__ == '__main__':
    main()
