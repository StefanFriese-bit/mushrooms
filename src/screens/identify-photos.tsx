import { useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { narrow, type Answers } from '../identify';
import { byPhotos, type ByPhotos, type PhotoWarning } from '../identify-photos';
import { speciesScores, type SpeciesScore } from '../scan/rules';
import { TESTED_PHOTOS, scorePhotos } from '../scan/run';
import { SETTINGS } from '../scan/settings';
import { recordWords } from '../scan/rows';
import { scanSwitchedOn } from '../scan/switched-on';
import { PhotoSlots, noPhotos, photosIn } from './photo-slots';
import { DANGER_WORDS, Row } from './identify-row';
import { Icon } from './icons';

// Identify, then photos (Stefan 10/10/2026; the rules are in src/identify-photos.ts): once he has answered, he adds
// photos and the scan puts the species that fit his answers in order of how much they look like his photos. The same
// photo slots and the same scan as the Scan screen; a dangerous species is never hidden; no word about eating.

/** What the photos said: each species' score. It does not depend on his answers, so a changed answer (or Back to
 * earlier answers) re-orders the list at once, and never shows an order worked out for other answers. */
type Scanned = { scores: Map<string, SpeciesScore>; count: number; english: Map<string, string> };
const and = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] ?? '');

function Warning({ w, english }: { w: PhotoWarning; english: Map<string, string> }) {
  const page = w.ours ? ALL_SPECIES.find((s) => s.scientific === w.ours) : undefined;
  const name = page?.english ?? english.get(w.name) ?? w.name;
  return (
    <li>{page ? <a href={hrefFor({ name: 'species', slug: page.slug })}>{name}</a> : <>{name} <span class="muted">(not in the guide)</span></>}{' '}
      <span class={`tag ${w.danger}`}>{DANGER_WORDS[w.danger]}</span></li>
  );
}

function Ranked({ by, count, english }: { by: ByPhotos; count: number; english: Map<string, string> }) {
  const red = by.warnings.length > 0 || by.dangerous.length > 0 || by.top.some((m) => m.danger);
  return (
    <div class="photo-ranked" data-test="photo-ranked" aria-live="polite">
      {red && <p class="card verdict red" role="alert">A dangerous species is on this list. Do the checks before anything else.</p>}
      {by.warnings.length > 0 && (
        <div class="card photo-warnings" data-test="photo-warnings">
          <p><strong>Your photos could also be {by.warnings.length === 1 ? 'this dangerous species' : 'these dangerous species'}</strong>,
            though {by.warnings.length === 1 ? 'it does' : 'they do'} not fit your answers. An answer can be wrong: rule{' '}
            {by.warnings.length === 1 ? 'it' : 'them'} out with its page and Check before anything else.</p>
          <ul>{by.warnings.map((w) => <Warning key={w.name} w={w} english={english} />)}</ul>
        </div>
      )}
      <h3 data-test="photo-top-title">{by.notSure ? 'Closest to your photos — but they do not point clearly to any of these'
        : 'Most like your photos'}</h3>
      {by.top.length === 0 && <p>The scan cannot recognise any of the species that fit your answers.</p>}
      {by.top.map((m) => <Row s={m} key={m.scientific} />)}
      {by.dangerous.length > 0 && (
        // One line each, so a long list (gilled species on wood: 17) stays in sight without burying the rest.
        <>
          <h3>Dangerous, and on the list whatever the photos say</h3>
          <ul class="danger-list" data-test="photo-dangerous">
            {by.dangerous.map((m) => (
              <li key={m.scientific}>{m.slug ? <a href={hrefFor({ name: 'species', slug: m.slug })}>{m.english}</a> : m.english}{' '}
                {m.danger && <span class={`tag ${m.danger}`}>{DANGER_WORDS[m.danger]}</span>}
                {m.keptFor && <span class="note"> · mistaken for {m.keptFor.join(', ')}</span>}</li>
            ))}
          </ul>
        </>
      )}
      {by.unknown.length > 0 && (
        <p class="note" data-test="photo-unknown">The scan cannot recognise {and(by.unknown.map((m) => m.english))}: your photos
          say nothing about {by.unknown.length === 1 ? 'it' : 'them'}, so {by.unknown.length === 1 ? 'it stays' : 'they stay'} on
          the list below.</p>
      )}
      {by.rest.length > 0 && (
        <details class="compare" data-test="photo-rest">
          <summary>{by.rest.length} more that fit your answers, less like your photos</summary>
          {by.rest.map((m) => <Row s={m} key={m.scientific} />)}
        </details>
      )}
      <p class="muted small">{count > TESTED_PHOTOS ? `Scanned with ${count} photos; the scan's test measured up to three. ` : ''}
        {SETTINGS.passed ? recordWords(SETTINGS.record) : ''}</p>
    </div>
  );
}

export function IdentifyPhotos({ answers }: { answers: Answers }) {
  const [slots, setSlots] = useState(noPhotos);
  const [stage, setStage] = useState<'idle' | 'loading' | 'scanning'>('idle');
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const S = SETTINGS;
  if (!S.passed) return null; // no scan, no photo step: the questions stand on their own
  const photos = photosIn(slots);
  const run = async () => {
    setProblem(null);
    setScanned(null);
    try {
      const sc = await scorePhotos(photos, setStage);
      const { bySpecies } = speciesScores(sc.averaged, sc.classes, new Date().getMonth() + 1, S.thresholds, sc.safety);
      const names = (await import('../../content/model/df20-names.json')).default.classes as Record<string, string>;
      setScanned({ scores: bySpecies, count: sc.count, english: new Map(Object.entries(names)) });
    } catch {
      setProblem('The photo scan isn\'t available right now. Open the app once with a signal so it can store the scan.');
    } finally {
      setStage('idle');
    }
  };
  return (
    <section class="card identify-photos" data-test="identify-photos">
      <h2><Icon name="camera" size={20} />Narrow it down with photos</h2>
      <p>Add photos of your mushroom — any one is enough, more help. The scan then puts the species that fit your answers in
        order of how much they look like your photos.</p>
      {!scanSwitchedOn() ? (
        <p data-test="scan-off">The photo scan is switched on once, after reading its test: <a href={hrefFor({ name: 'scan' })}>open
          Scan</a>, then come back here.</p>
      ) : (
        <>
          <PhotoSlots slots={slots} onChange={(next) => { setSlots(next); setScanned(null); }} />
          <p><button type="button" class="big-button wide" disabled={photos.length === 0 || stage !== 'idle'} onClick={run}>
            {stage === 'loading' ? 'Getting the scan ready…' : stage === 'scanning' ? 'Scanning…' : 'Narrow it down'}</button></p>
          {problem && <p class="card alert" role="alert">{problem}</p>}
          {scanned && <Ranked by={byPhotos(narrow(ALL_SPECIES, answers), scanned.scores, S.thresholds)} count={scanned.count}
            english={scanned.english} />}
        </>
      )}
    </section>
  );
}
