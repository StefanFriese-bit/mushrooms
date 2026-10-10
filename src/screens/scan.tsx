import { useEffect, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import { genusOf, shortlist, type ClassInfo, type Danger, type ScanResult } from '../scan/rules';
import { dangerousSpecies } from '../scan/danger';
import { PAGE_EDIBILITY, TESTED_PHOTOS, scorePhotos } from '../scan/run';
import { recordWords, scanRows, type ScanRow } from '../scan/rows';
import { REPORT_URL, SETTINGS } from '../scan/settings';
import { handOver, shrinkPhoto } from '../finds/device';
import { speciesNames } from '../species-names';
import { NextChecks } from './scan-checks';
import { PhotoSlots, noPhotos, photosIn } from './photo-slots';
import { scanSwitchedOn, switchScanOn } from '../scan/switched-on';
import { Icon } from './icons';
import type { SpeciesRecord } from '../types';

// Scan (spec 6.2, 8, 10): up to five photos (top, underneath, stem, base, cross-section — Stefan 10/10/2026; each one
// cropped to what matters if he likes) → the model on the phone → the shortlist. It
// is a shortlist, never an identification: a dangerous species on it raises the red banner, a weak result says "Not
// sure" and offers Identify, the next step is always Check, and no word about eating appears. The scan stays off
// unless it passed its test, and the first time he sees the test's record before switching it on.
const DANGER_WORDS = { deadly: 'Deadly', poisonous: 'Poisonous' } as const;

const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** The guide's species in a group: those the model files under that genus, and those it cannot name whose genus it is. */
function groupSpecies(genus: string, classes: ClassInfo[]): SpeciesRecord[] {
  const named = new Set(classes.filter((c) => c.ours && genusOf(c.name) === genus).map((c) => c.ours as string));
  const withClass = new Set(classes.filter((c) => c.ours).map((c) => c.ours as string));
  return ALL_SPECIES.filter((s) => named.has(s.scientific) || (!withClass.has(s.scientific) && genusOf(s.scientific) === genus));
}

/** The group headline ("most likely one of the brittlegills") and the guide's species in that group. */
function GroupLine({ genus, label, pages }: { genus: string; label?: string; pages: SpeciesRecord[] }) {
  const article = /^[AEIOU]/.test(genus) ? 'an' : 'a';
  return (
    <div class="card" data-test="scan-group">
      <p><strong>{label ? `Most likely one of the ${label.toLowerCase()}` : `Most likely ${article} ${genus}`}</strong>
        {label && <> (<i>{genus}</i>)</>}. In its test, the group named here was right {pc(SETTINGS.passed ? SETTINGS.record.groupRight : 0)} of the time.</p>
      {pages.length > 0 ? (
        <p>In the guide:{' '}{pages.map((s, i) => <span key={s.slug}>{i > 0 && ' · '}<a href={hrefFor({ name: 'species', slug: s.slug })}>{s.english}</a></span>)}</p>
      ) : <p>None of this group is in the guide.</p>}
    </div>
  );
}

/** One species on the shortlist (Stefan 10/10/2026: "the images … need to be larger with just the name next to it,
 * and then I can click on it"): its photo, large, and its name; the whole row opens its page. Its danger stays. */
function Row({ r }: { r: ScanRow }) {
  const page = r.slug ? bySlug(ALL_SPECIES, r.slug) : undefined;
  const text = (
    <span class="result-text">
      <span class="result-name">{r.english}</span>
      {r.danger && <span class={`tag ${r.danger}`}>{DANGER_WORDS[r.danger]}</span>}
      {r.forSafety && <span class="note">On the list because it is dangerous and the photos could be it.</span>}
      {!r.inList && <span class="note">Not in the guide — treat it as unknown.</span>}
      {r.inList && !page && <span class="note">Its page is not written yet.</span>}
    </span>
  );
  if (!page) return <div class={`result plain${r.forSafety ? ' kept' : ''}`} data-test="scan-row">{text}</div>;
  return (
    <a class={`result${r.forSafety ? ' kept' : ''}`} data-test="scan-row" href={hrefFor({ name: 'species', slug: page.slug })}>
      {page.photos[0] ? <img class="result-photo" src={`${import.meta.env.BASE_URL}${page.photos[0].file}`} alt="" loading="lazy" />
        : <span class="result-photo no-photo" />}
      {text}
      <Icon name="chevron" size={20} />
    </a>
  );
}

export function Scan() {
  const S = SETTINGS;
  const [ok, setOk] = useState(scanSwitchedOn);
  const [slots, setSlots] = useState(noPhotos);
  const [stage, setStage] = useState<'idle' | 'loading' | 'scanning'>('idle');
  const [scored, setScored] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [english, setEnglish] = useState(new Map<string, string>());
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [unknownDanger, setUnknownDanger] = useState<string[] | null>(null);
  const [danger, setDanger] = useState(new Map<string, 'deadly' | 'poisonous'>());
  // Is the model already stored on this phone (by the service worker), so the scan works with no signal?
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    if (!S.passed || !('caches' in window)) return;
    caches.match(`${import.meta.env.BASE_URL}${S.file}`, { ignoreSearch: true }).then((r) => setStored(!!r), () => setStored(null));
  }, []);
  // English names: the guide's own for its 300, the BMS's or iNaturalist's for every other species the model knows.
  useEffect(() => {
    Promise.all([speciesNames(), import('../../content/model/df20-names.json')]).then(([n, d]) => {
      setEnglish(new Map([...Object.entries(d.default.classes as Record<string, string>), ...n.map((x) => [x.name, x.english] as const)]));
      setGroupNames(d.default.groups as Record<string, string>);
    });
  }, []);
  useEffect(() => {
    if (ok || !S.passed) return;
    Promise.all([import('../../content/model/df20-classes.json'), import('../../content/species-list.json')]).then(([c, l]) => {
      const known = new Set((c.default.classes as ClassInfo[]).map((x) => x.ours).filter(Boolean));
      const dangerous = dangerousSpecies(l.default.species as Array<{ name: string; dangerLevel: Danger }>, PAGE_EDIBILITY);
      setUnknownDanger((l.default.species as Array<{ name: string; english: string | null }>)
        .filter((s) => dangerous.has(s.name) && !known.has(s.name)).map((s) => s.english ?? s.name));
    });
  }, [ok]);

  if (!S.passed) {
    return (
      <>
        <h1>Scan</h1>
        <p class="card">The photo scan is off: it didn't pass its safety test ({S.reason}, {S.tested}).</p>
        <p><a class="big-button" href={hrefFor({ name: 'identify', query: '' })}>Identify by questions</a></p>
      </>
    );
  }
  if (!ok) {
    return (
      <>
        <h1>Scan: its test first</h1>
        <p>{recordWords(S.record)}</p>
        {unknownDanger && unknownDanger.length > 0 && (
          <p>It cannot recognise these dangerous species at all: <strong>{unknownDanger.join(', ')}</strong>. Check on each
            page still compares them.</p>
        )}
        <p class="card">The scan gives a shortlist, never an answer. A dangerous species that could be in your photos is
          always added to the list, so you will often see one. Never eat a mushroom on the scan's word.</p>
        <p><a href={REPORT_URL}>The whole test report</a></p>
        <p><button type="button" class="big-button" onClick={() => { switchScanOn(); setOk(true); }}>
          I've read this — switch the scan on</button></p>
      </>
    );
  }

  const photos = photosIn(slots);
  const run = async () => {
    setProblem(null);
    setResult(null);
    try {
      // The banner and the safety rule use the same danger as the rows: the worse of the approved list and the page.
      const sc = await scorePhotos(photos, setStage);
      const list = (await import('../../content/species-list.json')).default.species as Array<{ name: string; dangerLevel: Danger }>;
      setDanger(dangerousSpecies(list, PAGE_EDIBILITY));
      setClasses(sc.classes);
      setResult(shortlist(sc.averaged, sc.classes, new Date().getMonth() + 1, S.thresholds, sc.safety));
      setScored(sc.count);
    } catch {
      setProblem('The photo scan isn\'t available right now. Open the app once with a signal so it can store the scan, or use Identify.');
    } finally {
      setStage('idle');
    }
  };
  const pages = new Map(ALL_SPECIES.map((s) => [s.scientific, { slug: s.slug, edibility: s.edibility.value }]));
  const rows = result ? scanRows(result, english, pages) : [];
  const group = result?.group ? { genus: result.group.genus, label: groupNames[result.group.genus], species: groupSpecies(result.group.genus, classes) } : null;
  // The photos go to a new find, scaled down; what it is stays "not identified yet" — a shortlist is not an answer.
  const saveAsFind = async () => {
    handOver(await Promise.all(photos.map((f) => shrinkPhoto(f))), null);
    location.hash = hrefFor({ name: 'find-new' });
  };

  return (
    <>
      <h1>Scan</h1>
      <p class="muted">Add what you have — any one photo is enough, more help. After each photo you can zoom in on the part
        that matters.</p>
      {stored === true && <p class="small" data-test="stored">✓ Stored on this phone: the scan works without a signal.</p>}
      {stored === false && <p class="small" data-test="stored">Not stored on this phone yet. Keep the app open on Wi-Fi for a
        minute, then come back here.</p>}
      <PhotoSlots slots={slots} onChange={(next) => { setSlots(next); setResult(null); }} />
      <p><button type="button" class="big-button wide" disabled={photos.length === 0 || stage !== 'idle'} onClick={run}>
        {stage === 'loading' ? 'Getting the scan ready…' : stage === 'scanning' ? 'Scanning…' : 'Scan'}</button></p>
      {problem && <p class="card" role="alert">{problem}</p>}
      {result && (
        <section data-test="scan-result" aria-live="polite">
          {result.dangerous && (
            <p class="card verdict red" role="alert">A dangerous species is on this list. Do the checks before anything else.</p>
          )}
          {group && <GroupLine genus={group.genus} label={group.label} pages={group.species} />}
          {result.notSure && (
            <div class="card" data-test="not-sure">
              <p><strong>Not certain which species.</strong> When it isn't certain, the right one is still on this list
                {' '}{pc(S.record.onListNotSure)} of the time (in its test): compare yours with each, then use Check.</p>
              <p><a href={hrefFor({ name: 'identify', query: '' })}>Or identify it by questions instead</a></p>
            </div>
          )}
          <h2>The shortlist</h2>
          {scored > TESTED_PHOTOS && (
            <p class="muted small" data-test="many-photos">Scanned with {scored} photos. The scan's test measured up to three; with
              more, a dangerous species stays on the list if any one photo could be it.</p>
          )}
          <p class="muted small">Tap one to see its page and photos.</p>
          {rows.map((r) => <Row r={r} key={r.scientific} />)}
          <NextChecks key={rows.map((r) => r.scientific).join('|')} rows={rows}
            group={group && group.species.length > 0 ? { label: group.label ? group.label.toLowerCase() : `${group.genus} species`, species: group.species } : null}
            dangerOf={(s) => danger.get(s.scientific) ?? null} />
          <p class="card">A shortlist is not an identification. The next step is Check: your mushroom against the
            species and the ones it is mistaken for, feature by feature.</p>
          <p class="muted small">{recordWords(S.record)}</p>
          <p><button type="button" class="small-button" onClick={saveAsFind}>Save these photos with this location</button>{' '}
            <button type="button" class="small-button" onClick={() => { setSlots(noPhotos()); setResult(null); }}>Scan another</button></p>
        </section>
      )}
    </>
  );
}
