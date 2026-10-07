import { useEffect, useRef, useState } from 'preact/hooks';
import type { Spot } from '../finds/store';
import { circleRing, type LatLon } from '../finds/geo';

// The map (spec 7): OpenFreeMap's tiles (OpenStreetMap data, credited on the map), his finds as pins, his position,
// and — when making a find — one pin he can move by tapping the map or dragging it. Areas he has looked at stay on
// the phone (the service worker keeps them), so a wood viewed at home shows in the wood with no signal. The map code
// loads only when a map is first shown.
type MapLib = typeof import('maplibre-gl');
type MapObj = InstanceType<MapLib['Map']>;
type MarkerObj = InstanceType<MapLib['Marker']>;

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const UK: [number, number] = [-2.5, 54.3];

/** `accuracy`: how exact its GPS spot is (metres), drawn as a circle round it; null = placed by hand. */
export type Pin = { id: string; lat: number; lon: number; label: string; href: string; accuracy?: number | null };
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
};

type Ring = { ring: Array<[number, number]>; kind: 'find' | 'here' };
/** Draws the accuracy circles once the map's style is ready (a map with no style yet, e.g. offline, shows none). */
function drawRings(m: MapObj, rings: Ring[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: rings.map((r) => ({ type: 'Feature' as const, properties: { kind: r.kind }, geometry: { type: 'Polygon' as const, coordinates: [r.ring] } })),
  };
  const draw = () => {
    const src = m.getSource('accuracy') as { setData: (d: typeof data) => void } | undefined;
    if (src) { src.setData(data); return; }
    m.addSource('accuracy', { type: 'geojson', data });
    const color = ['match', ['get', 'kind'], 'here', '#1a73e8', '#8a4b2a'] as unknown as string;
    m.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': color, 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'accuracy-line', type: 'line', source: 'accuracy', paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.7 } });
  };
  if (m.isStyleLoaded()) draw(); else m.once('load', draw);
}

export function FindsMap({ pins = [], locate = false, pick, here = null, tall = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const lib = useRef<MapLib | null>(null);
  const map = useRef<MapObj | null>(null);
  const pinMarkers = useRef<MarkerObj[]>([]);
  const pickMarker = useRef<MarkerObj | null>(null);
  const hereMarker = useRef<MarkerObj | null>(null);
  const framedHere = useRef(false);
  const onPick = useRef(pick?.onPick);
  onPick.current = pick?.onPick;
  const framed = useRef(false);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
        made = new ml.Map({ container: box.current, style: MAP_STYLE, center: UK, zoom: 5, attributionControl: { compact: true } });
        map.current = made;
        made.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
        if (locate) {
          const geo = new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true });
          made.addControl(geo, 'top-right');
          made.once('load', () => { if (!pins.length) geo.trigger(); });
        }
        let styled = false;
        made.once('load', () => { styled = true; setProblem(null); });
        made.on('error', () => {
          if (!styled) setProblem('The map needs a signal the first time an area is shown. Everything else works without one.');
        });
        made.on('click', (e) => onPick.current?.(e.lngLat.lat, e.lngLat.lng));
        setReady(true);
      } catch {
        if (!gone) setProblem('This phone could not draw the map. Your finds and their spots are still listed.');
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
      const pop = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = p.label;
      const open = document.createElement('a');
      open.href = p.href;
      open.textContent = 'Open';
      pop.append(name, document.createElement('br'), open);
      return new ml.Marker({ element: el }).setLngLat([p.lon, p.lat]).setPopup(new ml.Popup({ offset: 18 }).setDOMContent(pop)).addTo(m);
    });
    if (!framed.current && pins.length > 0 && !pick) {
      framed.current = true;
      // One find opens close in (about 100 m across), so the spot is clear among the trees.
      if (pins.length === 1) m.jumpTo({ center: [pins[0].lon, pins[0].lat], zoom: 18 });
      else {
        const lons = pins.map((p) => p.lon);
        const lats = pins.map((p) => p.lat);
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 50, maxZoom: 15, duration: 0 });
      }
    }
  }, [ready, pins]);

  // How exact each spot is: a circle round each find and round where he is now.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const rings: Ring[] = pins.filter((p) => p.accuracy).map((p) => ({ ring: circleRing(p, p.accuracy as number), kind: 'find' }));
    if (here) rings.push({ ring: circleRing(here, here.accuracy), kind: 'here' });
    drawRings(m, rings);
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
      m.jumpTo({ center: [spot.lon, spot.lat], zoom: 16 });
    } else {
      pickMarker.current.setLngLat([spot.lon, spot.lat]);
    }
  }, [ready, pick?.spot?.lat, pick?.spot?.lon]);

  return (
    <div class={`map-wrap${tall ? ' tall' : ''}`}>
      <div class="map" ref={box} data-test="map" />
      {problem && <p class="map-problem" role="status">{problem}</p>}
    </div>
  );
}
