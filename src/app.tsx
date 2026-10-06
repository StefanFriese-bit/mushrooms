import { useLayoutEffect, useState } from 'preact/hooks';
import { parseHash, hrefFor, type Route } from './router';
import { Guide } from './screens/guide';
import { SpeciesPage } from './screens/species-page';
import { Learn } from './screens/learn';
import { About } from './screens/about';
import { ComingSoon } from './screens/coming-soon';
import { ScanSpeed } from './screens/scan-speed';
import { Identify } from './screens/identify';
import { Check } from './screens/check';
import brand from './brand.json';

const TABS = [
  { name: 'scan', label: 'Scan' },
  { name: 'guide', label: 'Guide' },
  { name: 'identify', label: 'Identify' },
  { name: 'finds', label: 'Finds' },
  { name: 'learn', label: 'Learn' },
] as const;

/** The green band at the top: the mark from the home-screen icon, the name and the tagline (src/brand.json). */
function Header() {
  return (
    <header class="app-header">
      <a class="brand" href={hrefFor({ name: 'guide', query: '' })} aria-label={`${brand.name}, open the guide`}>
        <svg class="brand-mark" viewBox="88 96 336 344" aria-hidden="true">
          <path d="M96 268c0-92 72-164 160-164s160 72 160 164c0 14-11 24-25 24H121c-14 0-25-10-25-24z" fill="#e9d8b4" />
          <circle cx="200" cy="200" r="18" fill="#c9b48a" /><circle cx="296" cy="176" r="14" fill="#c9b48a" />
          <circle cx="338" cy="236" r="12" fill="#c9b48a" />
          <path d="M216 292h80l-10 116c-1 14-13 24-27 24h-6c-14 0-26-10-27-24z" fill="#f6f1e6" />
        </svg>
        <span class="brand-text">
          <span class="brand-name">{brand.name}</span>
          <span class="brand-tagline">{brand.tagline}</span>
        </span>
      </a>
    </header>
  );
}

/** A tab opens its section from the start (the guide unsearched, Identify with no answers). */
function tabHref(name: (typeof TABS)[number]['name']): string {
  if (name === 'guide' || name === 'identify') return hrefFor({ name, query: '' });
  return hrefFor({ name });
}

function screen(route: Route) {
  switch (route.name) {
    case 'guide': return <Guide query={route.query} />;
    case 'species': return <SpeciesPage slug={route.slug} />;
    case 'learn': return <Learn />;
    case 'about': return <About />;
    case 'scan-speed': return <ScanSpeed />;
    case 'scan': return <ComingSoon title="Scan" what="The photo scan" />;
    case 'identify': return <Identify query={route.query} />;
    case 'check': return <Check slug={route.slug} key={route.slug} />;
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
      <Header />
      <div class="test-banner" role="note">Test version — not for identifying mushrooms</div>
      <main>{screen(route)}</main>
      <nav class="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.name} href={tabHref(t.name)}
            aria-current={active === t.name ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      <p class="muted" style="text-align:center;font-size:12px"><a href="#/about">About</a></p>
    </div>
  );
}
