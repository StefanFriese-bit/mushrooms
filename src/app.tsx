import { useLayoutEffect, useState } from 'preact/hooks';
import { parseHash, hrefFor, type Route } from './router';
import { Guide } from './screens/guide';
import { SpeciesPage } from './screens/species-page';
import { Learn } from './screens/learn';
import { About } from './screens/about';
import { ScanSpeed } from './screens/scan-speed';
import { Identify } from './screens/identify';
import { Check } from './screens/check';
import { Scan } from './screens/scan';
import { Finds } from './screens/finds';
import { FindNew } from './screens/find-new';
import { FindPage } from './screens/find-page';
import { FindGo } from './screens/find-go';
import { UpdateBar } from './screens/update-bar';
import brand from './brand.json';
import { Home } from './screens/home';
import { MapHome } from './screens/map-home';
import { Lookalikes } from './screens/lookalikes';
import { Icon } from './screens/icons';
import { SECTIONS, sectionHref, sectionOf, type SectionName } from './sections';

/** The steel-blue band at the top, as on the dashboard: the mark from the home-screen icon, the name and the tagline
 * (src/brand.json), which open the home page; on every other page a Home button; About on the right. */
function Header({ home }: { home: boolean }) {
  return (
    <header class="app-header">
      <div class="app-header-row">
        {!home && (
          <a class="head-button" href={hrefFor({ name: 'home' })} aria-label="Home" data-test="home-button"><Icon name="home" size={22} /></a>
        )}
        <a class="brand" href={hrefFor({ name: 'home' })} aria-label={`${brand.name}, home`}>
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
        <a class="head-button" href={hrefFor({ name: 'about' })} aria-label="About this app" data-test="about-button"><Icon name="info" size={22} /></a>
      </div>
    </header>
  );
}

/** The sections at the foot of every page but the home page, as the dashboard's tab buttons: picture above word. */
function SectionBar({ active }: { active: SectionName | null }) {
  return (
    <nav class="tabs" aria-label="Sections">
      {SECTIONS.map((s) => (
        <a key={s.name} class="tab-btn" href={sectionHref(s.name)} aria-current={active === s.name ? 'page' : undefined}>
          <Icon name={s.icon} size={20} /><span>{s.label}</span>
        </a>
      ))}
    </nav>
  );
}

function screen(route: Route) {
  switch (route.name) {
    case 'home': return <Home />;
    case 'map': return <MapHome />;
    case 'guide': return <Guide query={route.query} />;
    case 'species': return <SpeciesPage slug={route.slug} />;
    case 'learn': return <Learn />;
    case 'about': return <About />;
    case 'scan-speed': return <ScanSpeed />;
    case 'scan': return <Scan />;
    case 'identify': return <Identify query={route.query} />;
    case 'check': return <Check slug={route.slug} key={route.slug} />;
    case 'lookalikes': return <Lookalikes slug={route.slug} n={route.n} />;
    case 'finds': return <Finds />;
    case 'find-new': return <FindNew />;
    case 'find': return <FindPage id={route.id} key={route.id} />;
    case 'find-go': return <FindGo id={route.id} key={route.id} />;
    default: return <><h1>Not found</h1><p><a href={hrefFor({ name: 'home' })}>Back to the start</a></p></>;
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
  const home = route.name === 'home';
  return (
    <div class={`shell${home ? ' at-home' : ''}`}>
      <Header home={home} />
      <UpdateBar addingFind={route.name === 'find-new'} />
      <main>{screen(route)}</main>
      {!home && <SectionBar active={sectionOf(route)} />}
    </div>
  );
}
