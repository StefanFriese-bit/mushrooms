import { useState } from 'preact/hooks';
import { STAGES, daysSince, growthChipText, latestGrowth, sayDays, stageOf, type GrowthLog } from '../finds/growth';
import { logGrowth, type Find } from '../finds/store';

// Growth at a saved location (the rules are in src/finds/growth.ts): the stage buttons, the list's chip, and the card on
// a location's page with its log and "Log its growth now".

/** The stages as buttons: the chosen one stays pressed; a tap on it again takes it back. */
export function GrowthPicker({ value, onPick, label }: { value: number | null; onPick: (stage: number | null) => void; label: string }) {
  return (
    <div class="growth-pick" role="group" aria-label={label} data-test="growth-pick">
      {STAGES.map((s) => (
        <button type="button" key={s.stage} class="growth-stage" aria-pressed={value === s.stage}
          onClick={() => onPick(value === s.stage ? null : s.stage)}>
          <span class="growth-short">{s.short}</span>
          <span class="growth-text"><strong>{s.name}</strong><span>{s.hint}</span></span>
        </button>
      ))}
    </div>
  );
}

/** In the list: "G1 · 3 days" — the stage last logged, and how long ago. */
export function GrowthChip({ log, now }: { log: GrowthLog[] | undefined; now: Date }) {
  const g = latestGrowth(log);
  const text = growthChipText(log, now);
  if (!g || !text) return null;
  const s = stageOf(g.stage);
  return <span class={`growth-chip g${g.stage}`} data-test="growth-chip" title={`${s.short} ${s.name}, logged ${sayDays(daysSince(g.at, now))}`}>{text}</span>;
}

const sayLogged = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** On a location's page: what he saw last and when, every earlier stage, and "Log its growth now" for each revisit. */
export function GrowthCard({ find, onChange }: { find: Find; onChange: (f: Find) => void }) {
  const [logging, setLogging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const now = new Date();
  const log = [...(find.growth ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const latest = log[0];
  const add = async (stage: number | null) => {
    if (stage === null) return;
    try {
      onChange(await logGrowth(find.id, stage));
      setLogging(false);
      setProblem(null);
    } catch {
      setProblem('The growth could not be saved on this phone. Please try again.');
    }
  };
  return (
    <section class="card growth-card" data-test="growth">
      <h2>Growth</h2>
      {latest ? (
        <p class="growth-now" data-test="growth-now">
          <span class={`growth-chip g${latest.stage}`}>{stageOf(latest.stage).short}</span>{' '}
          <strong>{stageOf(latest.stage).name}</strong>{' '}<span>· {sayDays(daysSince(latest.at, now))}</span>
        </p>
      ) : <p class="muted">No growth logged here yet.</p>}
      {log.length > 1 && (
        <ul class="growth-history" data-test="growth-history">
          {log.map((g) => <li key={g.at}>{stageOf(g.stage).short} {stageOf(g.stage).name} — {sayLogged(g.at)}</li>)}
        </ul>
      )}
      {problem && <p class="alert small" role="alert">{problem}</p>}
      {logging ? (
        <>
          <p class="small">What does it look like now?</p>
          <GrowthPicker value={null} onPick={add} label="Growth now" />
          <p><button type="button" class="small-button" onClick={() => setLogging(false)}>Cancel</button></p>
        </>
      ) : (
        <p><button type="button" class="small-button primary" onClick={() => setLogging(true)} data-test="log-growth">
          {latest ? 'Log its growth now' : 'Log its growth'}</button></p>
      )}
    </section>
  );
}
