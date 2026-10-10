import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { CARD_MM, PX_PER_CM_LIMITS, loadChecked, rulerScale, saveChecked, ticks, type RulerFrom } from '../ruler';
import { Icon } from './icons';

// The ruler on "How wide is the cap?" (Stefan 10/10/2026; the rules are in src/ruler.ts): down the right edge of the
// screen in centimetres, 0 at the top, the 5 and 10 cm marks — where the answers change — in blue; and a check against a
// bank card, kept on the phone.

const screenFacts = () => ({
  dpr: window.devicePixelRatio || 1,
  iPhone: /iPhone/.test(navigator.userAgent),
  width: screen.width,
  height: screen.height,
});

const WIDTH = 34; // the strip, in CSS pixels (styles.css: .screen-ruler and .ruler-on .shell)
const KEY_CM = new Set([0, 5, 10]);

function ScreenRuler({ pxPerCm }: { pxPerCm: number }) {
  const [height, setHeight] = useState(() => window.innerHeight);
  // A layout effect: the page steps aside (nothing hides under the strip) and back in the same frame as the strip comes
  // and goes — a passive effect's clean-up waits for the next paint, and the page would jump once.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('ruler-on');
    const on = () => setHeight(window.innerHeight);
    window.addEventListener('resize', on);
    return () => { root.classList.remove('ruler-on'); window.removeEventListener('resize', on); };
  }, []);
  const marks = ticks(height, pxPerCm);
  return (
    <div class="screen-ruler" aria-hidden="true" data-test="screen-ruler" data-px-per-cm={pxPerCm.toFixed(2)}>
      <svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        {marks.map((t) => {
          const key = t.cm !== undefined && KEY_CM.has(t.cm);
          const long = key ? WIDTH : t.size === 'cm' ? 15 : t.size === 'half' ? 10 : 6;
          // The 0 line is drawn just inside the top, so its top edge is the ruler's start.
          const y = t.cm === 0 ? 1 : t.y;
          return <line key={t.y} x1={WIDTH - long} x2={WIDTH} y1={y} y2={y} class={key ? 'rule-key' : 'rule-tick'} data-cm={t.cm} />;
        })}
        {marks.filter((t) => t.cm !== undefined).map((t) => (
          <text key={`n${t.cm}`} x={3} y={t.cm === 0 ? 14 : t.y - 3} class={KEY_CM.has(t.cm!) ? 'rule-num key' : 'rule-num'}>{t.cm}</text>
        ))}
      </svg>
    </div>
  );
}

/** Lay a bank card on the outline and make the outline the card's size: that sets the scale for this phone. */
function RulerCheck({ start, wasChecked, onSave, onForget, onCancel }: {
  start: number; wasChecked: boolean; onSave: (pxPerCm: number) => void; onForget: () => void; onCancel: () => void;
}) {
  const [px, setPx] = useState(start);
  const set = (v: number) => setPx(Math.min(PX_PER_CM_LIMITS.max, Math.max(PX_PER_CM_LIMITS.min, Math.round(v * 100) / 100)));
  const cm = (mm: number) => `${(mm / 10) * px}px`;
  return (
    <div class="ruler-check" role="dialog" aria-modal="true" aria-label="Check the ruler with a bank card" data-test="ruler-check">
      <div class="card-outline" data-test="card-outline"
        style={{ width: cm(CARD_MM.short), height: cm(CARD_MM.long), borderRadius: cm(3.18) }}>
        <span>Lay a bank card on this outline</span>
      </div>
      <p class="small">Make the outline exactly the size of the card, then save.</p>
      <div class="ruler-check-size">
        <button type="button" class="small-button" aria-label="Smaller" onClick={() => set(px - 0.1)}>−</button>
        <input type="range" min={PX_PER_CM_LIMITS.min} max={PX_PER_CM_LIMITS.max} step={0.05} value={px}
          aria-label="Size of the outline" onInput={(e) => set(Number((e.target as HTMLInputElement).value))} />
        <button type="button" class="small-button" aria-label="Larger" onClick={() => set(px + 0.1)}>+</button>
      </div>
      <div class="ruler-check-actions">
        {wasChecked && <button type="button" class="small-button" onClick={onForget}>Forget the check</button>}
        <button type="button" class="small-button" onClick={onCancel}>Cancel</button>
        <button type="button" class="small-button primary" onClick={() => onSave(px)}>Save</button>
      </div>
    </div>
  );
}

const SAID: Record<RulerFrom, string> = {
  card: 'Checked against a bank card.',
  iphone: 'Set for this iPhone’s screen.',
  unknown: 'Not checked on this phone yet: check it before you rely on it.',
};

/** The note under the question, the ruler itself and, when asked for, the check. */
export function CapRuler() {
  const [checked, setChecked] = useState(loadChecked);
  const [facts, setFacts] = useState(screenFacts);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const on = () => setFacts(screenFacts());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const scale = rulerScale(facts, checked);
  const keep = (devicePxPerCm: number | null) => { saveChecked(devicePxPerCm); setChecked(devicePxPerCm); setChecking(false); };
  return (
    <>
      <p class="ruler-note" data-test="ruler-note"><Icon name="ruler" size={20} />
        <span><strong>Ruler</strong> down the right edge of the screen, in centimetres from 0 at the top. Hold the phone
          beside the cap.{' '}<span class={scale.from === 'unknown' ? 'ruler-unchecked' : 'muted'}>{SAID[scale.from]}</span>{' '}
          <button type="button" class="link-button" onClick={() => setChecking(true)} data-test="ruler-check-open">
            Check it with a bank card</button></span></p>
      <ScreenRuler pxPerCm={scale.pxPerCm} />
      {checking && (
        <RulerCheck start={scale.pxPerCm} wasChecked={scale.from === 'card'} onCancel={() => setChecking(false)}
          onSave={(px) => keep(px * facts.dpr)} onForget={() => keep(null)} />
      )}
    </>
  );
}
