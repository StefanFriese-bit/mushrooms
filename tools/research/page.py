"""Write one species page from a compact description (used while writing the guide's batches): sources come from the
gathered extracts (tools/research/sources.py), the record is written as content/species/<slug>.json."""
import json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]


def S(value, *ids):
    return {'value': value, 'sources': list(ids)}


def write(slug, *, extract, partners=(), **fields):
    src = json.loads(subprocess.run([sys.executable, str(ROOT / 'tools/research/sources.py'), extract, *partners],
                                    capture_output=True, text=True, check=True).stdout)
    lst = {s['name']: s for s in json.loads((ROOT / 'content/species-list.json').read_text())['species']}
    sp = lst[fields['scientific']]
    rec = {'slug': slug, 'inatId': sp['inatId'], 'scientific': fields['scientific'], 'english': sp['english'] or fields['scientific'],
           'olderNames': fields.get('olderNames', []), 'edibility': fields['edibility'], 'edibilityNote': fields.get('edibilityNote'),
           'protectedInUk': fields.get('protectedInUk', S(False, 'wf-prot', 'wp-s41')), 'topPoints': fields['topPoints'],
           'habitat': fields['habitat'], 'seasonMonths': fields['seasonMonths'], 'sporePrint': fields['sporePrint'],
           'features': fields['features'], 'lookalikes': fields.get('lookalikes', []),
           'noDangerousLookalike': fields.get('noDangerousLookalike'), 'photos': [], 'sources': src, 'checked': '2026-10-06'}
    old = ROOT / f'content/species/{slug}.json'
    if old.exists():
        rec['photos'] = json.loads(old.read_text()).get('photos', [])
    old.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + '\n')
    print('wrote', slug)
