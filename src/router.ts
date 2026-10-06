export type Route =
  | { name: 'guide'; query: string }
  | { name: 'species'; slug: string }
  | { name: 'scan' }
  | { name: 'identify' }
  | { name: 'finds' }
  | { name: 'learn' }
  | { name: 'about' }
  | { name: 'not-found'; path: string };

const SIMPLE = ['scan', 'identify', 'finds', 'learn', 'about'] as const;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'guide') return { name: 'guide', query: new URLSearchParams(qs).get('q') ?? '' };
  if (parts[0] === 'species' && parts[1]) return { name: 'species', slug: decodeURIComponent(parts[1]) };
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
    case 'not-found':
      return '#/guide';
    default:
      return `#/${route.name}`;
  }
}
