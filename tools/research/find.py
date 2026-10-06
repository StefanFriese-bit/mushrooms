#!/usr/bin/env python3
"""Sentences in the gathered pages that mention any of the given words, with the site they came from. Searches each
page's full article text (cache/research/full/) when it was kept, else the short extract.
Usage: find.py <word|word...> <extract> ..."""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'cache/research'
pat = re.compile(sys.argv[1], re.I)
for name in sys.argv[2:]:
    print(f'## {name}')
    fulls = sorted((R / 'full').glob(f'{name}.*.txt'))
    blocks = [(f.name.split('.')[-2], f.read_text()) for f in fulls]
    if not blocks:
        blocks = [(m.group(1) if (m := re.match(r'\[(\w+)\]', b)) else '?', b)
                  for b in re.split(r'(?m)^(?=\[(?:fn|wf|wp|wt)\])', (R / f'{name}.txt').read_text())]
    for site, text in blocks:
        for sent in re.split(r'(?<=[.!?])\s+', re.sub(r'\s+', ' ', text)):
            if pat.search(sent) and len(sent) < 600:
                print(f'  [{site}] {sent[:320]}')
