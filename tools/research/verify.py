#!/usr/bin/env python3
"""Check a written page's citations against the pages they cite: for every fact in words, the best-matching sentence
from each cited source (its full article text, kept by gather.py). A source whose best sentence shares little with the
claim is marked '??' — read it, and fix the claim or the citation. Usage: verify.py <slug> [--all]"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / 'cache/research'
STOP = set('the a an and or of to in on at by for with from as is are be it its this that these those than then when '
           'very more most some any all not no never only also often usually sometimes into onto over under like which '
           'their there they them one two each other where what while once just about until'.split())


def words(t):
    return {w for w in re.findall(r"[a-z]+", t.lower()) if len(w) > 3 and w not in STOP}


def text_by_url():
    out = {}
    from page import SHARED  # shared articles are kept as full/<id>.txt
    for sid, (_, url) in SHARED.items():
        if (R / 'full' / f'{sid}.txt').exists():
            out[url] = (R / 'full' / f'{sid}.txt').read_text()
    for ex in R.glob('*.txt'):
        for site, url in re.findall(r'^\[(fn|wf|wp|wt|ns)\] (https?://\S+)', ex.read_text(), re.M):
            f = R / 'full' / f'{ex.stem}.{site}.txt'
            if f.exists():
                out[url] = f.read_text()
    return out


def best(claim, text):
    cw = words(claim)
    top = (0.0, '')
    for sent in re.split(r'(?<=[.!?])\s+', re.sub(r'\s+', ' ', text)):
        if len(sent) > 700:
            continue
        score = len(cw & words(sent)) / max(1, len(cw))
        if score > top[0]:
            top = (score, sent)
    return top


def facts(rec):
    for k in ('edibilityNote', 'habitat', 'sporePrint'):
        if rec.get(k):
            yield k, rec[k]['value'], rec[k]['sources']
    for i, t in enumerate(rec['topPoints'], 1):
        yield f'top point {i}', t['value'], t['sources']
    for k in ('fleshChange', 'smell'):
        f = rec['features'][k]
        yield k, f['value'], f['sources']
    for l in rec['lookalikes']:
        for r in l['tellApart']:
            yield f"{l['english']} / {r['feature']}", f"{r['thisOne']} — {r['thatOne']}", r['sources']


def main():
    texts = text_by_url()
    for path in ([ROOT / f'content/species/{sys.argv[1]}.json'] if sys.argv[1] != '--all' else sorted((ROOT / 'content/species').glob('*.json'))):
        rec = json.loads(path.read_text())
        url = {s['id']: s['url'] for s in rec['sources']}
        print(f'######## {rec["slug"]}')
        for label, claim, ids in facts(rec):
            print(f'  {label}: {claim}')
            for i in ids:
                t = texts.get(url.get(i, ''))
                if t is None:
                    print(f'      {i:8s} (no full text kept)')
                    continue
                score, sent = best(claim, t)
                print(f'    {"??" if score < 0.2 else "  "}{i:8s} {score:.2f} {sent[:230]}')


if __name__ == '__main__':
    main()
