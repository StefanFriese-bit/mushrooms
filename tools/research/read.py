#!/usr/bin/env python3
"""Show gathered extracts compactly: each section on one line, cut to N characters, only the sections a page needs.
Usage: read.py [-n 420] <extract> ..."""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
KEEP = re.compile(r'(?i)^(cap|caps|fruit|bracket|pores|tubes|gills|spines|teeth|stem|stipe|flesh|spore print|odou?r|smell|taste|habitat|'
                  r'season|similar|culinary|toxic|edib|possible|description|identification|ring|skirt|volva|fact box|how to|what does|not to be|'
                  r'when to see|uk status)')
args = sys.argv[1:]
n = 420
if args[:1] == ['-n']:
    n, args = int(args[1]), args[2:]
for name in args:
    text = (ROOT / 'cache/research' / f'{name}.txt').read_text()
    out, cur = [], None
    for line in text.split('\n'):
        if line.startswith(('#', '[', 'iNat')):
            if cur: out.append(cur)
            cur = None
            out.append(line[:200])
        elif re.match(r'^\s+- ', line):
            if cur: out.append(cur)
            cur = line.strip()[2:]
        elif cur is not None:
            cur += ' ' + line.strip()
    if cur: out.append(cur)
    for l in out:
        if l.startswith(('#', '[', 'iNat')) or KEEP.match(l):
            print(('  ' if not l.startswith(('#', '[', 'iNat')) else '') + re.sub(r'\s+', ' ', l)[:n])
    print()
