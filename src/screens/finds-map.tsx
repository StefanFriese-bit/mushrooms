import { useEffect, useRef, useState } from 'preact/hooks';
import type { Spot } from '../finds/store';
import { circleRing, gridLines, type LatLon } from '../finds/geo';
import { askForCompassOnTap, nextMapBearing } from '../finds/compass';
import { badgeByKey, type BadgeKey } from '../finds/badges';

// The map (spec 7): OpenFreeMap's tiles (OpenStreetMap data, credited on the map), his saved locations as pins, his
// position, and — when saving a location — one pin he can move by tapping the map or dragging it. It zooms in until a
// few metres fill the screen (the scale bar says how many). Areas he has looked at stay on
// the phone (the service worker keeps them), so a wood viewed at home shows in the wood with no signal. The map code
// loads only when a map is first shown.
type MapLib = typeof import('maplibre-gl');
type MapObj = InstanceType<MapLib['Map']>;
type MarkerObj = InstanceType<MapLib['Marker']>;

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** When OpenFreeMap cannot be reached (spec 7): OpenStreetMap's own tiles, online only — its tile policy forbids
 * keeping them for offline use, and the service worker never does — over a plain background, with the grid on top,
 * so his finds and his position always show, with or without a signal. */
const FALLBACK_STYLE = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
      attribution: '© OpenStreetMap contributors' },
  },
  layers: [
    { id: 'plain', type: 'background' as const, paint: { 'background-color': '#eef2e6' } },
    { id: 'osm', type: 'raster' as const, source: 'osm' },
  ],
};
const UK: [number, number] = [-2.5, 54.3];

/** `accuracy`: how exact its GPS spot is (metres), drawn as a circle round it; null = placed by hand. `goHref`: the walk
 * back to it ("Take me there"); `when`: when it was saved — both shown when its pin is tapped. */
export type Pin = { id: string; lat: number; lon: number; label: string; href: string; accuracy?: number | null; when?: string;
  /** Its place on the planned walk, 1, 2, 3 … — drawn in the pin. Left out when there is no walk. */
  stop?: number;
  /** The growth last logged there: "G1 Button · 3 days ago" (src/finds/growth.ts). */
  growth?: string; goHref?: string;
  /** Its pictures (src/finds/badges.ts): drawn as the pin itself, so the map says what grows where; two mushrooms found
   * together = both pictures side by side in one pin. */
  badges?: BadgeKey[] };
type Props = {
  pins?: Pin[];
  /** Show his position (the blue dot) and keep following it. */
  locate?: boolean;
  /** One pin for a new find: it sits on `spot`; tapping the map or dragging the pin moves it. */
  pick?: { spot: Spot | null; onPick: (lat: number, lon: number) => void };
  /** Where he is now, with how exact it is (walking back to a find): a dot and its circle; the map frames it with the
   * pins the first time it is known. */
  here?: (LatLon & { accuracy: number }) | null;
  tall?: boolean;
  /** Shorter, so the arrow, the distance and the map fit on one screen (Take me there). */
  short?: boolean;
  /** The planned walk, drawn as a line: where he started, then each stop in order (src/finds/walk.ts). Straight lines
   * over the ground — there is no path map on the phone, and it must work with no signal. */
  route?: LatLon[] | null;
  /** Turn the map so that the way he is facing is at the top, the way a car's GPS does (the compass heading in degrees,
   * src/finds/compass.ts). null or left out = north at the top. The pins stay upright: MapLibre holds a marker's own
   * element against the screen, not against the map. */
  facing?: number | null;
};

type Ring = { ring: Array<[number, number]>; kind: 'find' | 'here' };
/** Draws the accuracy circles once the map's style is ready (a map with no style yet, e.g. offline, shows none). */
function drawRings(m: MapObj, rings: Ring[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: rings.map((r) => ({ type: 'Feature' as const, properties: { kind: r.kind }, geometry: { type: 'Polygon' as const, coordinates: [r.ring] } })),
  };
  const src = m.getSource('accuracy') as { setData: (d: typeof data) => void } | undefined;
  if (src) { src.setData(data); return; }
  m.addSource('accuracy', { type: 'geojson', data });
  const color = ['match', ['get', 'kind'], 'here', '#1a73e8', '#e8590c'] as unknown as string;
  m.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': color, 'fill-opacity': 0.12 } });
  m.addLayer({ id: 'accuracy-line', type: 'line', source: 'accuracy', paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.7 } });
}

/** Bring a change to the walk up on the screen. ⚠ Needed, and not obvious: new data on a source does not by itself
 * repaint a map that has gone quiet — the walk was in the style, the map answered that it had rendered it, and the
 * screen still showed bare ground (13/10/2026, both test engines). A repaint once the source has finished loading
 * shows it; the timer is there for a phone that never says it finished. */
function wake(m: MapObj) {
  m.triggerRepaint();
  const done = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId !== 'route' || !e.isSourceLoaded) return;
    m.off('sourcedata', done as never);
    m.triggerRepaint();
  };
  m.on('sourcedata', done as never);
  setTimeout(() => { m.off('sourcedata', done as never); m.triggerRepaint(); }, 400);
}

/** The planned walk, leg by leg. Drawn under the pins, so a pin is never hidden by its own line. */
function drawRoute(m: MapObj, line: LatLon[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: line.length > 1 ? [{ type: 'Feature' as const, properties: {},
      geometry: { type: 'LineString' as const, coordinates: line.map((p) => [p.lon, p.lat] as [number, number]) } }] : [],
  };
  const src = m.getSource('route') as { setData: (d: typeof data) => void } | undefined;
  if (src) { src.setData(data); wake(m); return; }
  m.addSource('route', { type: 'geojson', data });
  // Solid, with a white casing under it so the walk reads over woodland, fields or a dark path. ⚠ Not dashed: a dashed
  // line drew nothing at all here (13/10/2026) while the map swore it had rendered it — and a walk he cannot see is
  // worse than a plain one.
  const look = { 'line-cap': 'round' as const, 'line-join': 'round' as const };
  m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: look,
    paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } });
  m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: look,
    paint: { 'line-color': '#1a73e8', 'line-width': 4.5, 'line-opacity': 0.95 } });
  wake(m);
}

/** The plain grid over whatever the map shows (nothing, when there is no map for the area), redrawn as he moves. */
function drawGrid(m: MapObj) {
  const b = m.getBounds();
  const data = {
    type: 'FeatureCollection' as const,
    features: gridLines({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }, m.getZoom())
      .map((line) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line } })),
  };
  const src = m.getSource('grid') as { setData: (d: typeof data) => void } | undefined;
  if (src) { src.setData(data); return; }
  m.addSource('grid', { type: 'geojson', data });
  m.addLayer({ id: 'grid-lines', type: 'line', source: 'grid', paint: { 'line-color': '#7f8c76', 'line-width': 1, 'line-opacity': 0.45 } });
}

export function FindsMap({ pins = [], locate = false, pick, here = null, tall = false, short = false, facing = null, route = null }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const lib = useRef<MapLib | null>(null);
  const map = useRef<MapObj | null>(null);
  const pinMarkers = useRef<MarkerObj[]>([]);
  const pickMarker = useRef<MarkerObj | null>(null);
  const hereMarker = useRef<MarkerObj | null>(null);
  const framedHere = useRef(false);
  const rings = useRef<Ring[]>([]);
  const routeLine = useRef<LatLon[]>([]);
  const [mode, setMode] = useState<'normal' | 'fallback'>('normal');
  const [grid, setGrid] = useState(false);
  const onPick = useRef(pick?.onPick);
  onPick.current = pick?.onPick;
  const framed = useRef(false);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Which way the map is really held, read back off the map after it was turned — never what it was asked to do. */
  const [turnedTo, setTurnedTo] = useState(0);
  /** How many points of the planned walk are really on the map — read back, not what it was asked to draw. */
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    let gone = false;
    let made: MapObj | null = null;
    (async () => {
      try {
        const ml = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (gone || !box.current) return;
        ml.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.js`);
        lib.current = ml;
        // Zoom 22 at the latitude of the UK puts about 1 cm on a screen point: the phone's width is about 4 m of ground.
        made = new ml.Map({ container: box.current, style: MAP_STYLE, center: UK, zoom: 5, maxZoom: 22, attributionControl: { compact: true } });
        map.current = made;
        (window as unknown as Record<string, unknown>).__map = made;
        made.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
        made.addControl(new ml.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
        if (locate) {
          const geo = new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true });
          made.addControl(geo, 'top-right');
          made.once('load', () => { if (!pins.length) geo.trigger(); });
        }
        let styled = false;
        let fellBack = false;
        let gridOn = false;
        const showGrid = (m: MapObj) => {
          if (!gridOn) { gridOn = true; setGrid(true); m.on('moveend', () => drawGrid(m)); }
          drawGrid(m);
        };
        made.once('load', () => { styled = true; if (!fellBack) setProblem(null); });
        // After any style (the first, or the fallback): the accuracy circles again, and the grid when it is on.
        made.on('style.load', () => {
          drawRings(made!, rings.current);
          if (routeLine.current.length > 1) drawRoute(made!, routeLine.current);
          if (gridOn) drawGrid(made!);
        });
        made.on('error', (event) => {
          const e = event as unknown as { sourceId?: string };
          if (!styled && !fellBack) {
            // OpenFreeMap's style could not be had (no signal and never stored, or the service is down).
            fellBack = true;
            setMode('fallback');
            setProblem('Back-up map: OpenStreetMap while there is a signal, a plain grid without one.');
            made!.setStyle(FALLBACK_STYLE);
            made!.once('style.load', () => showGrid(made!));
          } else if (styled && e.sourceId && !gridOn) {
            showGrid(made!); // the map has no tiles here (never looked at with a signal): the grid keeps a sense of distance
          }
        });
        made.on('click', (e) => onPick.current?.(e.lngLat.lat, e.lngLat.lng));
        setReady(true);
      } catch {
        if (!gone) setProblem('This phone could not draw the map. Your saved locations are still listed.');
      }
    })();
    return () => { gone = true; made?.remove(); map.current = null; };
  }, []);

  // His finds as pins; the first time, the map frames them all.
  useEffect(() => {
    const ml = lib.current;
    const m = map.current;
    if (!ready || !ml || !m) return;
    for (const old of pinMarkers.current) old.remove();
    pinMarkers.current = pins.map((p) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pin';
      el.setAttribute('aria-label', p.label);
      el.setAttribute('data-test', 'map-pin');
      const badges = (p.badges ?? []).map((k) => badgeByKey(k)).filter((b) => b !== null);
      if (badges.length) {
        el.classList.add('pin-badge');
        if (badges.length > 1) el.classList.add('pin-badges-2');
        el.setAttribute('data-badge', badges.map((b) => b.key).join(' '));
        el.innerHTML = badges.map((b) => b.svg).join(''); // constant drawings (src/finds/badges.ts), never anything he typed
      }
      if (p.stop) {
        el.classList.add('pin-stop');
        const n = document.createElement('span');
        n.className = 'pin-stop-n';
        n.textContent = String(p.stop);
        el.append(n);
        el.setAttribute('aria-label', `Stop ${p.stop}: ${p.label}`);
      }
      const pop = document.createElement('div');
      pop.className = 'pin-pop';
      const name = document.createElement('strong');
      name.textContent = p.label;
      pop.append(name);
      if (p.when) {
        const when = document.createElement('span');
        when.className = 'pin-pop-when';
        when.textContent = p.when;
        pop.append(when);
      }
      if (p.growth) {
        const growth = document.createElement('span');
        growth.className = 'pin-pop-growth';
        growth.textContent = p.growth;
        pop.append(growth);
      }
      const links = document.createElement('span');
      links.className = 'pin-pop-links';
      if (p.goHref) {
        const go = document.createElement('a');
        go.href = p.goHref;
        go.className = 'pin-pop-go';
        go.textContent = 'Take me there';
        go.addEventListener('click', askForCompassOnTap);
        links.append(go);
      }
      const open = document.createElement('a');
      open.href = p.href;
      open.textContent = 'Details';
      links.append(open);
      pop.append(links);
      return new ml.Marker({ element: el }).setLngLat([p.lon, p.lat]).setPopup(new ml.Popup({ offset: 18 }).setDOMContent(pop)).addTo(m);
    });
    if (!framed.current && pins.length > 0 && !pick) {
      framed.current = true;
      // One location opens close in (about 100 m across), so the spot is clear among the trees; several are framed
      // together, as close in as that allows.
      if (pins.length === 1) m.jumpTo({ center: [pins[0].lon, pins[0].lat], zoom: 18 });
      else {
        const lons = pins.map((p) => p.lon);
        const lats = pins.map((p) => p.lat);
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 50, maxZoom: 18, duration: 0 });
      }
    }
  }, [ready, pins]);

  // How exact each spot is: a circle round each find and round where he is now.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const next: Ring[] = pins.filter((p) => p.accuracy).map((p) => ({ ring: circleRing(p, p.accuracy as number), kind: 'find' }));
    if (here) next.push({ ring: circleRing(here, here.accuracy), kind: 'here' });
    rings.current = next;
    if (m.isStyleLoaded()) drawRings(m, next); // otherwise the style's own load draws them
  }, [ready, pins, here?.lat, here?.lon, here?.accuracy]);

  // Where he is now: a dot; the first time it is known, the map frames him and the find(s) together.
  useEffect(() => {
    const ml = lib.current;
    const m = map.current;
    if (!ready || !ml || !m || !here) return;
    if (!hereMarker.current) {
      const el = document.createElement('div');
      el.className = 'here-dot';
      el.setAttribute('data-test', 'here-dot');
      hereMarker.current = new ml.Marker({ element: el }).setLngLat([here.lon, here.lat]).addTo(m);
    } else {
      hereMarker.current.setLngLat([here.lon, here.lat]);
    }
    if (!framedHere.current && pins.length > 0) {
      framedHere.current = true;
      const lons = [here.lon, ...pins.map((p) => p.lon)];
      const lats = [here.lat, ...pins.map((p) => p.lat)];
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, maxZoom: 19, duration: 0 });
    }
  }, [ready, here?.lat, here?.lon]);

  // The planned walk on the map.
  // ⚠ Not `isStyleLoaded()`: MapLibre answers false to that while a drawn, tiled map is still settling, and the walk
  // was then silently never drawn (seen 13/10/2026). Draw it, and if the style will not take a layer yet, draw it on
  // the next word from the style.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    routeLine.current = route ?? [];
    const draw = () => {
      try { drawRoute(m, routeLine.current); setDrawn(routeLine.current.length); return true; } catch { return false; }
    };
    if (draw()) return;
    const again = () => { if (draw()) m.off('styledata', again); };
    m.on('styledata', again);
    return () => m.off('styledata', again);
  }, [ready, route]);

  // Turned the way he points the phone: the ground ahead of him is at the top of the map, so what he sees on the screen
  // lies the way the wood does in front of him. Only a real turn moves it (MAP_TURN_MIN_DEG), or the compass's own
  // wandering would keep the map shivering while he stands still.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const to = nextMapBearing(m.getBearing(), facing);
    if (to === null) return;
    m.setBearing(to);
    setTurnedTo(m.getBearing()); // what the map now holds, asked of the map itself
  }, [ready, facing]);

  // The new find's pin: placed on its spot, moved by a tap on the map or by dragging it.
  useEffect(() => {
    const ml = lib.current;
    const m = map.current;
    const spot = pick?.spot;
    if (!ready || !ml || !m || !spot) return;
    if (!pickMarker.current) {
      const el = document.createElement('div');
      el.className = 'pin pin-new';
      el.setAttribute('data-test', 'pick-pin');
      pickMarker.current = new ml.Marker({ element: el, draggable: true }).setLngLat([spot.lon, spot.lat]).addTo(m);
      pickMarker.current.on('dragend', () => {
        const at = pickMarker.current!.getLngLat();
        onPick.current?.(at.lat, at.lng);
      });
      m.jumpTo({ center: [spot.lon, spot.lat], zoom: 18 });
    } else {
      pickMarker.current.setLngLat([spot.lon, spot.lat]);
    }
  }, [ready, pick?.spot?.lat, pick?.spot?.lon]);

  return (
    <div class={`map-wrap${tall ? ' tall' : ''}${short ? ' short' : ''}`} data-map-mode={mode} data-grid={grid ? 'on' : 'off'}
      data-bearing={Math.round(turnedTo)} data-route-points={drawn}>
      <div class="map" ref={box} data-test="map" />
      {/* With the map turned, where north has gone — so a turned map can still be read against a paper one. */}
      {facing !== null && (
        <svg class="map-north" viewBox="-16 -16 32 32" data-test="map-north" role="img" aria-label={`North is ${Math.round(((360 - turnedTo) % 360))}° round from the top of the screen`}>
          <circle r="15" class="map-north-ring" />
          {/* The red wedge sits at the rim and swings round to where north has gone; the letter stays upright in the
              middle, so it is readable whichever way the map is held. */}
          <g transform={`rotate(${-turnedTo})`}><path d="M0 -14.5 L4.5 -7 L-4.5 -7 Z" class="map-north-needle" /></g>
          <text y="1" class="map-north-n">N</text>
        </svg>
      )}
      {problem && <p class="map-problem" role="status">{problem}</p>}
    </div>
  );
}
