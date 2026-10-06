import type { JSX } from 'preact';

// The drawings beside Identify's answers: line drawings on a 64 × 64 grid in the text colour. The underside is seen
// from below, as he sees it when he turns the mushroom over; everything else from the side.
const C = 32;
const at = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
const spokes = (n: number, r1: number, r2: number) =>
  Array.from({ length: n }, (_, i) => `M${at(r1, (i / n) * 2 * Math.PI)}L${at(r2, (i / n) * 2 * Math.PI)}`).join('');
/** Points on a grid inside the ring between r1 and r2. */
const grid = (step: number, r1: number, r2: number) => {
  const out: Array<[number, number]> = [];
  for (let y = C - r2; y <= C + r2; y += step) {
    for (let x = C - r2 + ((Math.round((y - C) / step) % 2) * step) / 2; x <= C + r2; x += step) {
      const d = Math.hypot(x - C, y - C);
      if (d >= r1 && d <= r2) out.push([x, y]);
    }
  }
  return out;
};
/** A mushroom from the side, standing on (x, y), its cap `w` wide. */
const mushroom = (x: number, y: number, w: number, h = w * 0.9) => (
  <>
    <path d={`M${x - w * 0.09} ${y}V${y - h * 0.55}h${w * 0.18}V${y}`} />
    <path d={`M${x - w / 2} ${y - h * 0.55}Q${x} ${y - h * 1.35} ${x + w / 2} ${y - h * 0.55}Z`} />
  </>
);
const below = (inner: JSX.Element) => (
  <>
    <circle cx={C} cy={C} r={27} />
    <circle cx={C} cy={C} r={5} />
    {inner}
  </>
);
const paper = (fill: string, ink: string, dark = false) => (
  <>
    <rect x={4} y={4} width={56} height={56} rx={6} fill={dark ? '#4a4a4a' : '#fff'} />
    <circle cx={C} cy={C} r={21} fill={ink} stroke="none" />
    <path d={spokes(30, 6, 20)} stroke={fill} stroke-width={1} opacity={0.45} />
  </>
);
/** A ruler marked 0, 5 and 10 cm, with a cap of that width standing on it. */
const ruler = (
  <>
    <path d="M6 48H58M6 45v6M32 45v6M58 45v6" />
    {([[6, '0'], [32, '5'], [58, '10']] as const).map(([x, t]) => (
      <text x={x} y={59} font-size={9} text-anchor="middle" stroke="none" fill="currentColor">{t}</text>
    ))}
  </>
);
const capOn = (cm: number) => {
  const w = cm * 5.2;
  const mid = 6 + w / 2;
  return (
    <>
      <path d={`M${mid - 1.6} 39V48M${mid + 1.6} 39V48`} stroke-width={1.5} />
      <path d={`M6 39Q${mid} ${39 - w * 0.75} ${6 + w} 39Z`} fill="currentColor" fill-opacity={0.15} />
    </>
  );
};

export const DRAWINGS: Record<string, () => JSX.Element> = {
  gills: () => below(<path d={spokes(40, 7, 26)} stroke-width={1} />),
  pores: () => below(<>{grid(5, 8.5, 24).map(([x, y]) => <circle cx={x} cy={y} r={1.5} stroke-width={1} />)}</>),
  teeth: () => below(<>{grid(5, 8.5, 24).map(([x, y]) => <path d={`M${x} ${y - 1.8}l1.4 3h-2.8z`} fill="currentColor" stroke="none" />)}</>),
  ridges: () => below(<path stroke-width={2.2} d={Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * 2 * Math.PI;
    return `M${at(7, a)}L${at(16, a)}L${at(26, a - 0.13)}M${at(16, a)}L${at(26, a + 0.13)}`;
  }).join('')} />),
  smooth: () => below(<circle cx={C} cy={C} r={27} fill="currentColor" opacity={0.08} stroke="none" />),
  other: () => (
    <>
      <path d="M17 52C10 36 18 16 32 16S54 36 47 52Z" />
      {[[26, 28], [36, 26], [31, 36], [41, 38], [23, 42], [34, 46]].map(([x, y]) => <circle cx={x} cy={y} r={1.2} fill="currentColor" stroke="none" />)}
      <path d="M6 52H58" />
    </>
  ),
  ground: () => (
    <>
      {mushroom(32, 52, 30)}
      <path d="M4 52H60M10 52l-2-5M12 52l1-6M50 52l-1-5M53 52l2-6" />
    </>
  ),
  wood: () => (
    <>
      <rect x={5} y={40} width={50} height={18} rx={9} />
      <ellipse cx={51} cy={49} rx={5} ry={8.5} />
      <path d="M51 45v8" stroke-width={1} />
      {mushroom(20, 40, 16)}
      {mushroom(33, 40, 13)}
    </>
  ),
  'other-fungi': () => (
    <>
      <path d="M6 56Q8 40 32 38T58 56Z" />
      <path d="M14 50q4-3 8 0M38 48q4-3 8 0" stroke-width={1} />
      {mushroom(25, 40, 10)}
      {mushroom(38, 39, 9)}
    </>
  ),
  dung: () => (
    <>
      <path d="M6 57Q8 46 18 47Q24 40 34 44Q46 40 52 48Q58 50 58 57Z" />
      <path d="M31 43V22h2v21" />
      <path d="M26 24Q32 4 38 24Z" />
    </>
  ),
  ring: () => (
    <>
      <path d="M8 24Q32 -2 56 24Z" />
      <path d="M29 24V58M35 24V58" />
      <path d="M27 30H37L41 38H23Z" />
    </>
  ),
  'no-ring': () => (
    <>
      <path d="M8 24Q32 -2 56 24Z" />
      <path d="M29 24V58M35 24V58" />
    </>
  ),
  bag: () => (
    <>
      <path d="M29 4V40M35 4V40" />
      <ellipse cx={32} cy={46} rx={7} ry={6} />
      <path d="M21 38Q20 58 32 58Q44 58 43 38M21 38l3 3M43 38l-3 3" />
      <path d="M4 44H18M46 44H60" stroke-dasharray="2 3" />
    </>
  ),
  'no-bag': () => (
    <>
      <path d="M29 4V50M35 4V50" />
      <path d="M27 50Q32 54 37 50" />
      <path d="M4 50H60" stroke-dasharray="2 3" />
    </>
  ),
  'cap-small': () => <>{capOn(4)}{ruler}</>,
  'cap-medium': () => <>{capOn(7.5)}{ruler}</>,
  'cap-large': () => <>{capOn(12)}{ruler}</>,
  'spore-white': () => paper('#4a4a4a', '#f4f1ea', true),
  'spore-pink': () => paper('#fff', '#e3a59a'),
  'spore-brown': () => paper('#fff', '#a0612c'),
  'spore-dark': () => paper('#fff', '#3d2a26'),
};

export function Drawing({ name }: { name: string }) {
  const draw = DRAWINGS[name];
  return (
    <svg class="drawing" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width={2}
      stroke-linecap="round" stroke-linejoin="round">
      {draw ? draw() : null}
    </svg>
  );
}
