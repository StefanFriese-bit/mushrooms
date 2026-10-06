import { useEffect, useMemo, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import { combine, shortlist, type ClassInfo, type ScanResult } from '../scan/rules';
import { decode, loadEngine } from '../scan/engine';
import { recordWords, scanRows, type ScanRow } from '../scan/rows';
import { REPORT_URL, SETTINGS } from '../scan/settings';
import { handOver, shrinkPhoto } from '../finds/device';
import { speciesNames } from '../species-names';

// Scan (spec 6.2, 8, 10): up to three photos (top, underneath, base) → the model on the phone → the shortlist. It
// is a shortlist, never an identification: a dangerous species on it raises the red banner, a weak result says "Not
// sure" and offers Identify, the next step is always Check, and no word about eating appears. The scan stays off
// unless it passed its test, and the first time he sees the test's record before switching it on.
const SLOTS = ['Top of the cap', 'Underneath', 'Base of the stem'] as const;
const SEEN = 'scan-record-seen';
const DANGER_WORDS = { deadly: 'Deadly', poisonous: 'Poisonous' } as const;
const seen = () => { try { return localStorage.getItem(SEEN); } catch { return null; } };

function Row({ r, first }: { r: ScanRow; first: boolean }) {
  const page = r.slug ? bySlug(ALL_SPECIES, r.slug) : undefined;
  return (
    <div class={`row${r.forSafety ? ' kept' : ''}`} data-test="scan-row">
      {page?.photos[0] ? <img src={`${import.meta.env.BASE_URL}${page.photos[0].file}`} alt="" loading="lazy" /> : <span class="no-photo" />}
      <div class="grow">
        <div>{page ? <a href={hrefFor({ name: 'species', slug: page.slug })}>{r.english}</a> : r.english}{' '}
          {r.danger && <span class={`tag ${r.danger}`}>{DANGER_WORDS[r.danger]}</span>}</div>
        {r.english !== r.scientific && <div class="sci">{r.scientific}</div>}
        {r.forSafety && <div class="note">On the list because it is dangerous and the photos could be it.</div>}
        {!r.inList && <div class="note">Not in the guide — treat it as unknown.</div>}
        {r.inList && !page && <div class="note">Its page is not written yet.</div>}
      </div>
      {page && page.lookalikes.length > 0 && (
        <a class={first ? 'big-button' : 'small-button'} href={hrefFor({ name: 'check', slug: page.slug })}>Check</a>
      )}
    </div>
  );
}

export function Scan() {
  const S = SETTINGS;
  const [ok, setOk] = useState(() => S.passed && seen() === S.tested);
  const [files, setFiles] = useState<Array<File | null>>([null, null, null]);
  const [stage, setStage] = useState<'idle' | 'loading' | 'scanning'>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [english, setEnglish] = useState(new Map<string, string>());
  const [unknownDanger, setUnknownDanger] = useState<string[] | null>(null);
  const previews = useMemo(() => files.map((f) => (f ? URL.createObjectURL(f) : null)), [files]);
  // Is the model already stored on this phone (by the service worker), so the scan works with no signal?
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    if (!S.passed || !('caches' in window)) return;
    caches.match(`${import.meta.env.BASE_URL}${S.file}`, { ignoreSearch: true }).then((r) => setStored(!!r), () => setStored(null));
  }, []);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  useEffect(() => { speciesNames().then((n) => setEnglish(new Map(n.map((x) => [x.name, x.english])))); }, []);
  useEffect(() => {
    if (ok || !S.passed) return;
    Promise.all([import('../../content/model/df20-classes.json'), import('../../content/species-list.json')]).then(([c, l]) => {
      const known = new Set((c.default.classes as ClassInfo[]).map((x) => x.ours).filter(Boolean));
      setUnknownDanger(l.default.species.filter((s: { name: string; dangerLevel: string | null }) => s.dangerLevel && !known.has(s.name))
        .map((s: { english: string | null; name: string }) => s.english ?? s.name));
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
        <p><button type="button" class="big-button" onClick={() => {
          try { localStorage.setItem(SEEN, S.tested); } catch { /* not kept: he will see this again next time */ }
          setOk(true);
        }}>I've read this — switch the scan on</button></p>
      </>
    );
  }

  const photos = files.filter((f): f is File => f !== null);
  const run = async () => {
    setProblem(null);
    setResult(null);
    setStage('loading');
    try {
      const engine = await loadEngine(S.file, S.size, S.fit);
      setStage('scanning');
      const scores: Float32Array[] = [];
      for (const f of photos) {
        const p = await decode(f);
        try { scores.push(await engine.score(p)); } finally { URL.revokeObjectURL(p.url); }
      }
      const classes = (await import('../../content/model/df20-classes.json')).default.classes as ClassInfo[];
      setResult(shortlist(combine(scores), classes, new Date().getMonth() + 1, S.thresholds));
    } catch {
      setProblem('The photo scan isn\'t available right now. Open the app once with a signal so it can store the scan, or use Identify.');
    } finally {
      setStage('idle');
    }
  };
  const pages = new Map(ALL_SPECIES.map((s) => [s.scientific, { slug: s.slug, edibility: s.edibility.value }]));
  const rows = result ? scanRows(result, english, pages) : [];
  // The photos go to a new find, scaled down; what it is stays "not identified yet" — a shortlist is not an answer.
  const saveAsFind = async () => {
    handOver(await Promise.all(photos.map((f) => shrinkPhoto(f))), null);
    location.hash = hrefFor({ name: 'find-new' });
  };

  return (
    <>
      <h1>Scan</h1>
      <p class="muted">Up to three photos: the top of the cap, underneath it, and the base of the stem. Keep the mushroom
        in the middle of the photo.</p>
      {stored === true && <p class="small" data-test="stored">✓ Stored on this phone: the scan works without a signal.</p>}
      {stored === false && <p class="small" data-test="stored">Not stored on this phone yet. Keep the app open on Wi-Fi for a
        minute, then come back here.</p>}
      <div class="slots">
        {SLOTS.map((label, i) => (
          <figure class="slot" key={label}>
            {previews[i] ? <img src={previews[i]!} alt={label} /> : <span class="slot-empty">+</span>}
            <figcaption>{label}</figcaption>
            {files[i] ? (
              <button type="button" class="small-button" onClick={() => { setFiles((fs) => fs.map((f, k) => (k === i ? null : f))); setResult(null); }}>
                Remove</button>
            ) : (
              <label class="small-button file-button">Add<input type="file" accept="image/*" aria-label={`${label} photo`}
                onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0] ?? null; setFiles((fs) => fs.map((x, k) => (k === i ? f : x))); setResult(null); }} />
              </label>
            )}
          </figure>
        ))}
      </div>
      <p><button type="button" class="big-button" disabled={photos.length === 0 || stage !== 'idle'} onClick={run}>
        {stage === 'loading' ? 'Getting the scan ready…' : stage === 'scanning' ? 'Scanning…' : 'Scan'}</button></p>
      {problem && <p class="card" role="alert">{problem}</p>}
      {result && (
        <section data-test="scan-result" aria-live="polite">
          {result.dangerous && (
            <p class="card verdict red" role="alert">A dangerous species is on this list. Do the checks before anything else.</p>
          )}
          {result.notSure && (
            <div class="card">
              <p><strong>Not sure:</strong> the scan can't tell from these photos.</p>
              <p><a href={hrefFor({ name: 'identify', query: '' })}>Identify it by questions instead</a></p>
            </div>
          )}
          <h2>The shortlist</h2>
          {rows.map((r, i) => <Row r={r} first={i === 0} key={r.scientific} />)}
          <p class="card">A shortlist is not an identification. The next step is Check: your mushroom against the
            species and the ones it is mistaken for, feature by feature.</p>
          <p class="muted small">{recordWords(S.record)}</p>
          <p><button type="button" class="small-button" onClick={saveAsFind}>Save these photos as a find</button>{' '}
            <button type="button" class="small-button" onClick={() => { setFiles([null, null, null]); setResult(null); }}>Scan another</button></p>
        </section>
      )}
    </>
  );
}
