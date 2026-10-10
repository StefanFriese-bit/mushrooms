import { hrefFor, type Route } from './router';

// The four sections (Stefan 10/10/2026: "at the top it should be [the Map], then Scan, then Guide, then Identify";
// Learn was taken off the same day, "not useful for me" — its page still opens at #/learn, nothing leads to it): the
// home page's buttons and the bar at the foot of every other page. ONE list, so the two can never disagree about the
// order or the names.
export const SECTIONS = [
  { name: 'map', label: 'Map', icon: 'map' },
  { name: 'scan', label: 'Scan', icon: 'scan' },
  { name: 'guide', label: 'Guide', icon: 'guide' },
  { name: 'identify', label: 'Identify', icon: 'identify' },
] as const;
export type SectionName = (typeof SECTIONS)[number]['name'];

/** A section opens at its start: the guide unsearched, Identify with no answers. */
export function sectionHref(name: SectionName): string {
  if (name === 'guide' || name === 'identify') return hrefFor({ name, query: '' });
  return hrefFor({ name });
}

/** The section a page belongs to (lit in the bar), or null: the home page, About, the speed test, Learn. */
export function sectionOf(route: Route): SectionName | null {
  switch (route.name) {
    case 'map': case 'finds': case 'find': case 'find-new': case 'find-go': return 'map';
    case 'scan': return 'scan';
    case 'guide': case 'species': case 'check': case 'lookalikes': return 'guide';
    case 'identify': return 'identify';
    default: return null;
  }
}
