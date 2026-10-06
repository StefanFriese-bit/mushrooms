export type Route =
  | { name: 'guide'; query: string }
  | { name: 'species'; slug: string }
  | { name: 'scan' }
  | { name: 'identify'; query: string } // the answers, as Identify writes them (src/identify.ts)
  | { name: 'check'; slug: string }
  | { name: 'finds' }
  | { name: 'learn' }
  | { name: 'about' }
  | { name: 'scan-speed' }
  | { name: 'not-found'; path: string };

const SIMPLE = ['scan', 'finds', 'learn', 'about', 'scan-speed'] as const;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'guide') return { name: 'guide', query: new URLSearchParams(qs).get('q') ?? '' };
  if (parts[0] === 'species' && parts[1]) return { name: 'species', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'check' && parts[1]) return { name: 'check', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'identify' && parts.length === 1) return { name: 'identify', query: qs };
  const simple = SIMPLE.find((n) => n === parts[0]);
  if (simple && parts.length === 1) return { name: simple };
  return { name: 'not-found', path };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'guide':
      return route.query ? `#/guide?${new URLSearchParams({ q: route.query })}` : '#/guide';
    case 'species':
      return `#/species/${encodeURIComponent(route.slug)}`;
    case 'check':
      return `#/check/${encodeURIComponent(route.slug)}`;
    case 'identify':
      return route.query ? `#/identify?${route.query}` : '#/identify';
    case 'not-found':
      return '#/guide';
    default:
      return `#/${route.name}`;
  }
}
