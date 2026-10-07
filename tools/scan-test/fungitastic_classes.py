"""The FungiTastic models' class list (2,829 classes) from the dataset's own training metadata, for
tools/build-class-map.ts --family fungitastic. The models' output number i is the training table's category_id i.

Reads  cache/fungitastic/FungiTastic/FungiTastic-Train.csv (from metadata.zip, unpacked)
Writes cache/fungitastic/classes.json: [{id, name, filedAs, photos}] in model order, where `name` is the class's own
       scientific name cut to two words ("Peniophora quercina (Pers.) Cooke" -> "Peniophora quercina") and `filedAs`
       the accepted name the dataset files it under (its `species` column), as tools/lib/df20-classes.ts expects.
Download: https://cmp.felk.cvut.cz/datagrid/FungiTastic/shared/download/metadata.zip (CC BY-NC 4.0, the BVRA team).
The file was refreshed on 2025-12-05; the models were trained earlier, so the scan test itself is the check that the
numbers still line up (a wrong list would put most photos under the wrong name)."""
import collections, csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / 'cache/fungitastic/FungiTastic/FungiTastic-Train.csv'
DST = ROOT / 'cache/fungitastic/classes.json'
csv.field_size_limit(10 ** 9)  # the captions column holds whole paragraphs


def binomial(s):
    m = re.match(r'^([A-Z][a-z]+) ([a-z][a-z-]+)', s.strip())
    return f'{m.group(1)} {m.group(2)}' if m else None


own, filed, photos = {}, {}, collections.Counter()
with SRC.open(newline='') as f:
    for r in csv.DictReader(f):
        c = int(r['category_id'])
        photos[c] += 1
        for seen, value in ((own, r['scientificName']), (filed, r['species'])):
            if seen.setdefault(c, value) != value:
                raise SystemExit(f'class {c} carries two names: {seen[c]!r} and {value!r}')
ids = sorted(photos)
if ids != list(range(len(ids))):
    raise SystemExit('category_id does not run 0 … n-1: the names would not line up with the model')
out = [{'id': c, 'name': binomial(own[c]) or filed[c].strip(), 'filedAs': filed[c].strip(), 'photos': photos[c]} for c in ids]
DST.write_text(json.dumps(out))
print(f'{len(out)} classes, {sum(photos.values())} training photos -> {DST.relative_to(ROOT)}')
