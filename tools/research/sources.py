#!/usr/bin/env python3
"""Print a page's sources block from the gathered extracts, so no address is typed by hand.
Usage: sources.py <extract name> [<partner extract>=<id suffix> ...]
  sources.py penny-bun-cep                      → fn, wf, wp, wt (whichever were found) + the two protection lists
  sources.py blusher panthercap=pc              → also fn-pc, wf-pc, wp-pc for the lookalike's rows"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = {'fn': 'First Nature', 'wf': 'Wild Food UK', 'wp': 'Wikipedia', 'wt': 'Woodland Trust'}
FIXED = [
    {'id': 'wf-prot', 'title': 'Wild Food UK — Protected UK fungi (DEFRA list)', 'url': 'https://www.wildfooduk.com/protected-uk-fungi/'},
    {'id': 'wp-s41', 'title': 'Wikipedia — List of species and habitats of principal importance in England',
     'url': 'https://en.wikipedia.org/wiki/List_of_species_and_habitats_of_principal_importance_in_England'},
]


def found(name):
    text = (ROOT / 'cache/research' / f'{name}.txt').read_text()
    head = re.match(r'######## (.*?) — (.*?) \(', text)
    english, sci = head.group(1), head.group(2)
    out = []
    for tag, url in re.findall(r'^\[(fn|wf|wp|wt)\] (https?://\S+)', text, re.M):
        title = {'fn': f'{SITE[tag]} — {sci}, {english}', 'wf': f'{SITE[tag]} — {english}', 'wp': f'{SITE[tag]} — {sci}',
                 'wt': f'{SITE[tag]} — {english}'}[tag]
        out.append((tag, title, url))
    return out


def main():
    own, *partners = sys.argv[1:]
    block = [{'id': tag, 'title': t, 'url': u} for tag, t, u in found(own)]
    for p in partners:
        name, suffix = p.split('=')
        block += [{'id': f'{tag}-{suffix}', 'title': t, 'url': u} for tag, t, u in found(name)]
    print(json.dumps(block + FIXED, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
