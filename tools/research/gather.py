#!/usr/bin/env python3
"""Gather the identification facts the guide's pages are written from (spec 5.1, 5.3), one short extract per species.

For each species: First Nature, Wild Food UK, Wikipedia (its text and its mycology fact box) and the Woodland Trust,
under the current scientific name and the older ones (sites keep old names). Only the article's identification
sections are kept — never reader comments — and each is cut short. One polite request per site at a time.

Usage: gather.py <scientific name> ... | --batch 1 | --batch 2      writes cache/research/<slug>.txt (never published)
The pages themselves are written in our own words from these extracts; nothing here is copied into the app."""
import html, json, pathlib, re, ssl, sys, time, urllib.error, urllib.request
from urllib.parse import quote, urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'cache/research'
UA = 'mushrooms-research/1.0 (https://github.com/StefanFriese-bit/mushrooms; personal, non-commercial)'
CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem')  # this Mac's Python has no CA bundle of its own
_last = {}

WANT = {
    'fn': ['cap', 'gills', 'stem', 'stipe', 'flesh', 'spore', 'odour', 'smell', 'taste', 'habitat', 'season', 'similar',
           'toxicity', 'culinary', 'identification', 'tubes', 'pores', 'spines', 'teeth', 'fruitbody', 'fruiting', 'ring'],
    'wf': ['cap', 'gills', 'stem', 'skirt', 'ring', 'flesh', 'pores', 'tubes', 'habitat', 'possible confusion', 'spore',
           'taste', 'smell', 'frequency', 'other facts'],
    'wp': ['description', 'similar species', 'habitat', 'ecology', 'distribution and habitat', 'toxicity', 'edibility', 'uses'],
    'wt': ['how to identify', 'what does', 'where to find', 'not to be confused', 'did you know'],
}


def fetch(url):
    host = urlparse(url).hostname
    gap = 1.25 - (time.time() - _last.get(host, 0.0))
    if gap > 0:
        time.sleep(gap)
    _last[host] = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30, context=CTX) as r:
            return r.status, r.read().decode('utf-8', 'replace'), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, '', url
    except Exception as e:  # a dropped connection is reported, never fatal
        return -1, str(e), url


def text_of(fragment):
    fragment = re.sub(r'(?is)<(script|style|sup|figure|figcaption|noscript)[^>]*>.*?</\1>', ' ', fragment)
    fragment = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</tr>', '\n', fragment)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', fragment))
    t = re.sub(r'\[\s*(edit|\d+)\s*\]', '', t)
    return re.sub(r'[ \t\r\f\v]+', ' ', re.sub(r'\n\s*\n+', '\n', t)).strip()


def sections(page):
    page = re.split(r'(?i)<div[^>]+id="comments"|<section[^>]+class="[^"]*comments|Leave a Reply|\d+\s+responses? to', page)[0]
    parts = re.split(r'(?is)(<h[1-4][^>]*>.*?</h[1-4]>)', page)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        head = text_of(parts[i])
        if head and head not in out:
            out[head] = text_of(parts[i + 1])
    return out


def keep(secs, wanted, limit):
    lines = []
    for k, v in secs.items():
        if v and any(w in k.lower() for w in wanted):
            lines.append(f'  - {k}: {v[:limit]}')
    return lines


def factbox(page):
    """Wikipedia's 'Mycological characteristics' box, as plain lines ('Spore print is white', 'Edibility is deadly')."""
    m = re.search(r'(?is)<table[^>]*class="[^"]*infobox[^"]*"[^>]*>(?:(?!</table>).)*?Mycological characteristics.*?</table>', page)
    if not m:
        return []
    rows = [r.strip() for r in text_of(m.group(0)).split('\n') if r.strip()]
    return [r for r in rows if re.search(r'(?i)\b(is|has|are|on|or)\b', r) and len(r) < 80 and 'Mycological' not in r][:16]


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


# First Nature files a few of ours under another species' page: it treats Collybia dealbata as Clitocybe rivulosa.
FN_PAGE = {'Collybia dealbata': 'https://www.first-nature.com/fungi/clitocybe-rivulosa.php'}


def core_urls(name, site='wildfooduk.com/mushroom-guide/'):
    """Addresses on one site that the approved core lists already hold for this species (exact, sourced)."""
    core = json.loads((ROOT / 'tools/config/core-lists.json').read_text())
    urls = []
    for key in ('edibles', 'dangerous', 'noDangerousLookalike'):  # entries about this one species, so their pages are its pages
        for e in core.get(key, []):
            if name in (e.get('name'), e.get('edible')):
                urls += [u for u in e.get('sources', []) if site in u]
    return list(dict.fromkeys(urls))


def keep_full(slug, site, page):
    d = OUT / 'full'
    d.mkdir(parents=True, exist_ok=True)
    body = re.split(r'(?i)<div[^>]+id="comments"|<section[^>]+class="[^"]*comments|Leave a Reply|\d+\s+responses? to', page)[0]
    (d / f'{slug}.{site}.txt').write_text(text_of(body))


def wild_food(name, names, parts, slug):
    """Wild Food UK's page for the species: tried under the English name, then the scientific names (it files some
    species that way, e.g. mycena-rosea), then the approved lists' address."""
    tries = [f'https://www.wildfooduk.com/mushroom-guide/{p}{v}/' for p in parts for v in ('', '-2', '-3')] + \
        [f'https://www.wildfooduk.com/mushroom-guide/{slugify(n)}/' for n in names] + core_urls(name)
    for url in list(dict.fromkeys(tries)):
        code, page, final = fetch(url)
        if code == 200 and '/mushroom-guide/' in final:
            keep_full(slug, 'wf', page)
            label = re.search(r'(?s)>\s*(Edible|Poisonous|Deadly|Inedible|Not Edible)\s*<', page)
            return [f'[wf] {final}  label={label.group(1) if label else "?"}'] + keep(sections(page), WANT['wf'], 600)
    return ['[wf] no page']


def gather(sp, older, wt_index):
    name, english = sp['name'], sp['english'] or sp['name']
    slug = slugify(english)
    names = [name] + [o for o in older.get(name, []) if re.match(r'^[A-Z][a-z]+ [a-z-]+$', o)][:4]
    out = [f'######## {english} — {name} (older names: {", ".join(names[1:]) or "none"})', f'iNat {sp["inatId"]}, '
           f'danger level on the approved list: {sp.get("dangerLevel") or "none"}, reasons: {", ".join(sp.get("reasons") or [])}']
    # The species' own address first; the approved lists' addresses after. A list entry about a DANGEROUS species can
    # cite its edible lookalike's page (the Funeral Bell's cites the Velvet Shank's), which is not this species' page.
    fn_tries = ([FN_PAGE[name]] if name in FN_PAGE else []) + \
        [f'https://www.first-nature.com/fungi/{slugify(n)}.php' for n in names] + core_urls(name, 'first-nature.com/fungi/')
    for url in list(dict.fromkeys(fn_tries)):  # First Nature: the first address it files the species under
        code, page, _ = fetch(url)
        if code == 200 and len(page) > 3000:
            keep_full(slug, 'fn', page)
            out.append(f'[fn] {url}')
            out += keep(sections(page), WANT['fn'], 700)
            break
    else:
        out.append('[fn] no page under any name')
    parts = [slugify(re.sub(r"['.’]", '', x)) for x in re.split(r'\s*/\s*', english)] if sp['english'] else []
    out += wild_food(name, names, parts, slug)
    for n in names:  # Wikipedia follows its own redirects from older names
        url = f'https://en.wikipedia.org/wiki/{quote(n.replace(" ", "_"))}'
        code, page, final = fetch(url)
        if code == 200:
            keep_full(slug, 'wp', page)
            out.append(f'[wp] {final}')
            box = factbox(page)
            if box:
                out.append('  - fact box: ' + ' | '.join(box))
            out += keep(sections(page), WANT['wp'], 1100)
            break
    else:
        out.append('[wp] no page under any name')
    for path in wt_index:
        if any(n.lower() in path[1] for n in names):
            code, page, final = fetch('https://www.woodlandtrust.org.uk' + path[0])
            if code == 200:
                keep_full(slug, 'wt', page)
                out.append(f'[wt] {final}')
                out += keep(sections(page), WANT['wt'], 700)
            break
    return '\n'.join(out) + '\n'


def main():
    lst = json.loads((ROOT / 'content/species-list.json').read_text())['species']
    older = json.loads((ROOT / 'cache/df20/older-names.json').read_text()) if (ROOT / 'cache/df20/older-names.json').exists() else {}
    have = {json.loads(p.read_text())['scientific'] for p in (ROOT / 'content/species').glob('*.json')}
    args = sys.argv[1:]
    if args[:1] == ['--wf-retry']:  # extracts that found no Wild Food UK page: try the scientific-name addresses
        for sp in lst:
            stem = slugify(sp['english'] or sp['name'])
            ex = OUT / f'{stem}.txt'
            if not ex.exists() or not re.search(r'^\[wf\] no page', ex.read_text(), re.M):
                continue
            names = [sp['name']] + [o for o in older.get(sp['name'], []) if re.match(r'^[A-Z][a-z]+ [a-z-]+$', o)][:4]
            parts = [slugify(re.sub(r"['.’]", '', x)) for x in re.split(r'\s*/\s*', sp['english'])] if sp['english'] else []
            got = wild_food(sp['name'], names, parts, stem)
            if got[0] != '[wf] no page':
                text = re.sub(r'^\[wf\] no page[^\n]*\n', '\n'.join(got) + '\n', ex.read_text(), flags=re.M)
                ex.write_text(text)
                print('found', stem, got[0], flush=True)
        return
    if args[:1] == ['--batch']:
        edible_or_danger = [s for s in lst if 'edible' in (s.get('reasons') or []) or s.get('dangerLevel')]
        chosen = edible_or_danger if args[1] == '1' else [s for s in lst if s not in edible_or_danger]
        chosen = [s for s in chosen if s['name'] not in have]
    else:
        chosen = [s for s in lst if s['name'] in args]
    OUT.mkdir(parents=True, exist_ok=True)
    code, idx, _ = fetch('https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/fungi-and-lichens/')
    wt = []
    for p in sorted(set(re.findall(r'href="(/trees-woods-and-wildlife/fungi-and-lichens/[a-z0-9-]+/)"', idx))):
        c, page, _ = fetch('https://www.woodlandtrust.org.uk' + p)
        sci = re.search(r'(?i)<em>\s*([A-Z][a-z]+ [a-z-]+)\s*</em>', page)
        wt.append((p, (sci.group(1) if sci else '').lower() + ' ' + p))
    for i, sp in enumerate(chosen, 1):
        dst = OUT / f'{slugify(sp["english"] or sp["name"])}.txt'
        if dst.exists() and (OUT / 'full' / f'{dst.stem}.wp.txt').exists():
            continue
        dst.write_text(gather(sp, older, wt))
        print(f'{i}/{len(chosen)} {sp["english"] or sp["name"]}', flush=True)


if __name__ == '__main__':
    main()
