export type Route =
  | { name: 'home' } // the five sections (Stefan 10/10/2026)
  | { name: 'map' } // the Map: "Save a location" or "View map"
  | { name: 'guide'; query: string }
  | { name: 'species'; slug: string }
  | { name: 'scan' }
  | { name: 'identify'; query: string } // the answers, as Identify writes them (src/identify.ts)
  | { name: 'check'; slug: string }
  | { name: 'finds' } // View map: the saved locations on the map and in a list
  | { name: 'find-new' } // Save a location
  | { name: 'find'; id: string }
  | { name: 'find-go'; id: string } // walking back to a find: arrow and distance
  | { name: 'learn' }
  | { name: 'about' }
  | { name: 'scan-speed' }
  | { name: 'not-found'; path: string };

const SIMPLE = ['map', 'scan', 'finds', 'learn', 'about', 'scan-speed'] as const;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'guide' && parts.length === 1) return { name: 'guide', query: new URLSearchParams(qs).get('q') ?? '' };
  if (parts[0] === 'species' && parts[1]) return { name: 'species', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'check' && parts[1]) return { name: 'check', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'finds' && parts[1] === 'new' && parts.length === 2) return { name: 'find-new' };
  if (parts[0] === 'finds' && parts[1] && parts.length === 2) return { name: 'find', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'finds' && parts[1] && parts[2] === 'go' && parts.length === 3) return { name: 'find-go', id: decodeURIComponent(parts[1]) };
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
    case 'find-new':
      return '#/finds/new';
    case 'find':
      return `#/finds/${encodeURIComponent(route.id)}`;
    case 'find-go':
      return `#/finds/${encodeURIComponent(route.id)}/go`;
    case 'identify':
      return route.query ? `#/identify?${route.query}` : '#/identify';
    case 'home':
    case 'not-found':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}
