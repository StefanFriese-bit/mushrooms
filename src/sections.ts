import { hrefFor, type Route } from './router';
import { askForCompassOnTap } from './finds/compass';
import { DOGS_GO_HREF, dogsButtonHref } from './finds/dogs';

// The sections (Stefan 10/10/2026: "at the top it should be [the Map], then Scan, then Guide, then Identify"; Learn was
// taken off the same day, "not useful for me" — its page still opens at #/learn, nothing leads to it; Dogs added last on
// 13/10/2026 — where he tied the dogs, and the way back to them): the home page's buttons and the bar at the foot of
// every other page. ONE list, so the two can never disagree about the order or the names.
export const SECTIONS = [
  { name: 'map', label: 'Map', icon: 'map' },
  { name: 'scan', label: 'Scan', icon: 'scan' },
  { name: 'guide', label: 'Guide', icon: 'guide' },
  { name: 'identify', label: 'Identify', icon: 'identify' },
  { name: 'dogs', label: 'Dogs', icon: 'paw' },
] as const;
export type SectionName = (typeof SECTIONS)[number]['name'];

/** A section opens at its start: the guide unsearched, Identify with no answers. Dogs opens the walk back to them while
 * this walk's spot is saved, else the screen that saves it (src/finds/dogs.ts). */
export function sectionHref(name: SectionName): string {
  if (name === 'guide' || name === 'identify') return hrefFor({ name, query: '' });
  if (name === 'dogs') return dogsButtonHref();
  return hrefFor({ name });
}

/** A tap on a section's button. The walk back to the dogs uses the compass, and an iPhone asks for it only from a tap
 * (src/finds/compass.ts) — so the question is asked in this one, decided by where the tapped button leads. */
export function onSectionTap(e: Event): void {
  if ((e.currentTarget as HTMLAnchorElement | null)?.getAttribute('href') === DOGS_GO_HREF) askForCompassOnTap();
}

/** The section a page belongs to (lit in the bar), or null: the home page, About, the speed test, Learn. */
export function sectionOf(route: Route): SectionName | null {
  switch (route.name) {
    case 'map': case 'finds': case 'find': case 'find-new': case 'find-go': case 'tracks': case 'track': return 'map';
    case 'scan': return 'scan';
    case 'guide': case 'species': case 'check': case 'lookalikes': return 'guide';
    case 'identify': return 'identify';
    case 'dogs': case 'dogs-new': case 'dogs-go': return 'dogs';
    default: return null;
  }
}
