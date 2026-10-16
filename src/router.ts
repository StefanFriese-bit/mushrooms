export type Route =
  | { name: 'home' } // the five sections (Stefan 10/10/2026)
  | { name: 'map' } // the Map: "Save a location" or "View map"
  | { name: 'guide'; query: string }
  | { name: 'species'; slug: string }
  | { name: 'scan' }
  | { name: 'identify'; query: string } // the answers, as Identify writes them (src/identify.ts)
  | { name: 'check'; slug: string }
  | { name: 'lookalikes'; slug: string; n: number } // a species' lookalikes, one at a time (n = which, from 0)
  | { name: 'finds' } // View map: the saved locations on the map and in a list
  | { name: 'find-new' } // Save a location
  | { name: 'find'; id: string }
  | { name: 'find-go'; id: string } // walking back to a find: arrow and distance
  | { name: 'dogs' } // the dogs' spot: save it, or (once saved) walk back to it
  | { name: 'dogs-new' } // save a new spot for the dogs, replacing the saved one
  | { name: 'dogs-go' } // walking back to the dogs: arrow and distance
  | { name: 'tracks' } // Record a walk: Start, and the walks recorded before (Stefan 16/10/2026)
  | { name: 'track'; id: string } // one recorded walk
  | { name: 'learn' }
  | { name: 'about' }
  | { name: 'scan-speed' }
  | { name: 'not-found'; path: string };

const SIMPLE = ['map', 'scan', 'finds', 'learn', 'about', 'scan-speed', 'dogs'] as const;
export const TRACKS_HREF = '#/walks';

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'guide' && parts.length === 1) return { name: 'guide', query: new URLSearchParams(qs).get('q') ?? '' };
  if (parts[0] === 'species' && parts[1]) return { name: 'species', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'check' && parts[1]) return { name: 'check', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'lookalikes' && parts[1] && parts.length === 2) {
    const n = Number(new URLSearchParams(qs).get('n') ?? 0);
    return { name: 'lookalikes', slug: decodeURIComponent(parts[1]), n: Number.isInteger(n) && n > 0 ? n : 0 };
  }
  if (parts[0] === 'finds' && parts[1] === 'new' && parts.length === 2) return { name: 'find-new' };
  if (parts[0] === 'finds' && parts[1] && parts.length === 2) return { name: 'find', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'finds' && parts[1] && parts[2] === 'go' && parts.length === 3) return { name: 'find-go', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'walks' && parts.length === 1) return { name: 'tracks' };
  if (parts[0] === 'walks' && parts[1] && parts.length === 2) return { name: 'track', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'identify' && parts.length === 1) return { name: 'identify', query: qs };
  if (parts[0] === 'dogs' && parts[1] === 'new' && parts.length === 2) return { name: 'dogs-new' };
  if (parts[0] === 'dogs' && parts[1] === 'go' && parts.length === 2) return { name: 'dogs-go' };
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
    case 'lookalikes':
      return `#/lookalikes/${encodeURIComponent(route.slug)}${route.n > 0 ? `?n=${route.n}` : ''}`;
    case 'find-new':
      return '#/finds/new';
    case 'find':
      return `#/finds/${encodeURIComponent(route.id)}`;
    case 'find-go':
      return `#/finds/${encodeURIComponent(route.id)}/go`;
    case 'identify':
      return route.query ? `#/identify?${route.query}` : '#/identify';
    case 'dogs-new':
      return '#/dogs/new';
    case 'dogs-go':
      return '#/dogs/go';
    case 'tracks':
      return TRACKS_HREF;
    case 'track':
      return `#/walks/${encodeURIComponent(route.id)}`;
    case 'home':
    case 'not-found':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}
