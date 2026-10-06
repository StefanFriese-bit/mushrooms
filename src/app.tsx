import { useLayoutEffect, useState } from 'preact/hooks';
import { parseHash, hrefFor, type Route } from './router';
import { Guide } from './screens/guide';
import { SpeciesPage } from './screens/species-page';
import { Learn } from './screens/learn';
import { About } from './screens/about';
import { ComingSoon } from './screens/coming-soon';

const TABS = [
  { name: 'scan', label: 'Scan' },
  { name: 'guide', label: 'Guide' },
  { name: 'identify', label: 'Identify' },
  { name: 'finds', label: 'Finds' },
  { name: 'learn', label: 'Learn' },
] as const;

function screen(route: Route) {
  switch (route.name) {
    case 'guide': return <Guide query={route.query} />;
    case 'species': return <SpeciesPage slug={route.slug} />;
    case 'learn': return <Learn />;
    case 'about': return <About />;
    case 'scan': return <ComingSoon title="Scan" what="The photo scan" />;
    case 'identify': return <ComingSoon title="Identify" what="Identifying by questions" />;
    case 'finds': return <ComingSoon title="Finds" what="Your map of finds" />;
    default: return <><h1>Not found</h1><p><a href="#/guide">Open the guide</a></p></>;
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  // Listen from the first render (a layout effect runs before the browser can deliver an event), and catch up on a
  // change of address made before the listener existed: under load the Safari engine delivered one in that gap.
  useLayoutEffect(() => {
    const onHash = () => { setRoute(parseHash(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    const now = parseHash(location.hash);
    setRoute((r) => (JSON.stringify(r) === JSON.stringify(now) ? r : now));
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const active = route.name === 'species' ? 'guide' : route.name;
  return (
    <div class="shell">
      <div class="test-banner" role="note">Test version — not for identifying mushrooms</div>
      <main>{screen(route)}</main>
      <nav class="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.name} href={hrefFor(t.name === 'guide' ? { name: 'guide', query: '' } : { name: t.name })}
            aria-current={active === t.name ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      <p class="muted" style="text-align:center;font-size:12px"><a href="#/about">About</a></p>
    </div>
  );
}
