"""Write one species page from a compact description (used while writing the guide's batches): sources come from the
gathered extracts (tools/research/sources.py), the record is written as content/species/<slug>.json."""
import json, pathlib, subprocess, sys
from datetime import date
ROOT = pathlib.Path(__file__).resolve().parents[2]


def S(value, *ids):
    return {'value': value, 'sources': list(ids)}


# Shared articles that cover several species, cited by id like a page's own sources.
SHARED = {
    'wf-poison': ('Wild Food UK — The most poisonous UK fungi, part 1', 'https://www.wildfooduk.com/articles/the-most-poisonous-uk-fungi-part-1/'),
    'wt-poison': ('Woodland Trust — Poisonous mushrooms: 8 most dangerous UK mushrooms', 'https://www.woodlandtrust.org.uk/blog/2025/02/poisonous-mushrooms/'),
    'wt-bracket': ('Woodland Trust — Bracket fungi ID: common UK species', 'https://www.woodlandtrust.org.uk/blog/2021/10/bracket-fungi-identification/'),
}


def write(slug, *, extract, partners=(), extra=(), drop=(), titles=None, **fields):
    """extra: ids from SHARED to add; drop: source ids to leave out (a page with no content); titles: {id: title}."""
    src = json.loads(subprocess.run([sys.executable, str(ROOT / 'tools/research/sources.py'), extract, *partners],
                                    capture_output=True, text=True, check=True).stdout)
    src = [s for s in src if s['id'] not in drop]
    at = next((i for i, s in enumerate(src) if s['id'] == 'wf-prot'), len(src))
    src[at:at] = [{'id': k, 'title': SHARED[k][0], 'url': SHARED[k][1]} for k in extra]
    for s in src:
        if titles and s['id'] in titles:
            s['title'] = titles[s['id']]
    lst = {s['name']: s for s in json.loads((ROOT / 'content/species-list.json').read_text())['species']}
    sp = lst[fields['scientific']]
    rec = {'slug': slug, 'inatId': sp['inatId'], 'scientific': fields['scientific'], 'english': sp['english'] or fields['scientific'],
           'olderNames': fields.get('olderNames', []), 'edibility': fields['edibility'], 'edibilityNote': fields.get('edibilityNote'),
           'protectedInUk': fields.get('protectedInUk', S(False, 'wf-prot', 'wp-s41')), 'topPoints': fields['topPoints'],
           'habitat': fields['habitat'], 'seasonMonths': fields['seasonMonths'], 'sporePrint': fields['sporePrint'],
           'features': fields['features'], 'lookalikes': fields.get('lookalikes', []),
           'noDangerousLookalike': fields.get('noDangerousLookalike'), 'photos': [], 'sources': src, 'checked': fields.get('checked', date.today().isoformat())}
    old = ROOT / f'content/species/{slug}.json'
    if old.exists():
        rec['photos'] = json.loads(old.read_text()).get('photos', [])
    old.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + '\n')
    print('wrote', slug)


KIND = {'edible-cooked': 'edible', 'edible-some-react': 'edible', 'not-edible': 'not-edible', 'poisonous': 'poisonous', 'deadly': 'deadly'}


def link_back(target, *, page, extract, suffix, rows):
    """Give page `target` a lookalike entry pointing at the written page `page` (its tell-apart rows written from the
    target's side; ids with `-suffix` are the page's own sources, added to the target's sources from `extract`)."""
    sys.path.insert(0, str(ROOT / 'tools/research'))
    from sources import found
    me = json.loads((ROOT / f'content/species/{page}.json').read_text())
    p = ROOT / f'content/species/{target}.json'
    r = json.loads(p.read_text())
    entry = {'scientific': me['scientific'], 'english': me['english'], 'slug': me['slug'], 'kind': KIND[me['edibility']['value']],
             'tellApart': rows}
    r['lookalikes'] = [l for l in r['lookalikes'] if l['scientific'] != me['scientific']] + [entry]
    have = {s['id'] for s in r['sources']}
    used = {i for row in rows for i in row['sources']}
    add = [{'id': f'{tag}-{suffix}', 'title': t, 'url': u} for tag, t, u in found(extract) if f'{tag}-{suffix}' in used and f'{tag}-{suffix}' not in have]
    at = next((i for i, s in enumerate(r['sources']) if s['id'] == 'wf-prot'), len(r['sources']))
    r['sources'][at:at] = add
    p.write_text(json.dumps(r, ensure_ascii=False, indent=2) + '\n')
    print('linked back', target, '->', page)
