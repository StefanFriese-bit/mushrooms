// Growth at a saved location (Stefan 10/10/2026: "if I come across a mushroom that's just coming out of the ground I can
// mark the location and … set kind of a level of growth … and then every day that passes we'll see on the location …
// a growth factor plus how many days have passed", read as "Porcini · G1 · 3 days ago", so he knows when to go back).
// His scale: G0 = just surfacing, G1 = popped out, a centimetre or two, G2 = about 5 cm. G3 and G4 finish it: grown, and
// gone over. A stage is what he saw, logged with the moment he logged it; each revisit adds one. The stages describe
// size and age only: nothing here says when a mushroom is ready to pick or eat.

export type GrowthLog = { stage: number; at: string };

export const STAGES = [
  { stage: 0, short: 'G0', name: 'Surfacing', hint: 'Just breaking through the ground' },
  { stage: 1, short: 'G1', name: 'Button', hint: 'Out of the ground, about 1 to 2 cm tall' },
  { stage: 2, short: 'G2', name: 'Young', hint: 'About 5 cm tall' },
  { stage: 3, short: 'G3', name: 'Grown', hint: 'Full size, the cap open' },
  { stage: 4, short: 'G4', name: 'Old', hint: 'Past its best: soft, rotting or eaten' },
] as const;

export const isStage = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < STAGES.length;
export const stageOf = (n: number) => STAGES[n];

/** The newest log, or null when nothing was logged. */
export function latestGrowth(log: readonly GrowthLog[] | undefined): GrowthLog | null {
  if (!log?.length) return null;
  return log.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a));
}

/** Whole days between two moments, counted by the phone's own calendar: logged at 23:50, it is "1 day" at 00:10. */
export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((start(now) - start(then)) / 86_400_000)); // round: a day can be 23 or 25 hours long
}

export const sayDays = (days: number) => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`);

/** "G1 · 3 days ago", or null when nothing was logged. */
export function growthLine(log: readonly GrowthLog[] | undefined, now: Date): string | null {
  const g = latestGrowth(log);
  return g ? `${stageOf(g.stage).short} · ${sayDays(daysSince(g.at, now))}` : null;
}

/** A log as saved in a backup is a list of stages with the moment each was logged; anything else is refused. */
export function isGrowthLog(v: unknown): v is GrowthLog[] {
  return Array.isArray(v) && v.every((g) => typeof g === 'object' && g !== null && isStage((g as GrowthLog).stage)
    && typeof (g as GrowthLog).at === 'string' && !Number.isNaN(Date.parse((g as GrowthLog).at)));
}

/** "G1 Button · 3 days ago", for the pin and the location's page; null when nothing was logged. */
export function growthWords(log: readonly GrowthLog[] | undefined, now: Date): string | null {
  const g = latestGrowth(log);
  return g ? `${stageOf(g.stage).short} ${stageOf(g.stage).name} · ${sayDays(daysSince(g.at, now))}` : null;
}

/** The list's chip: "G1 · 3 days" (the list has little room; "ago" is understood). */
export function growthChipText(log: readonly GrowthLog[] | undefined, now: Date): string | null {
  const g = latestGrowth(log);
  if (!g) return null;
  const days = daysSince(g.at, now);
  return `${stageOf(g.stage).short} · ${days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`}`;
}
