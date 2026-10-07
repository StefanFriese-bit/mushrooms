import { useEffect, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { keepData } from '../storage';
import { MODEL_FILES } from '../scan/model-files';

export function About() {
  const [kept, setKept] = useState<string>('checking…');
  useEffect(() => { keepData().then(setKept); }, []);
  return (
    <>
      <h1>About</h1>
      <p class="card">Never eat a mushroom on this app's word.</p>
      <p>{ALL_SPECIES.length} species in the guide. Built {__BUILD_DATE__}.</p>
      <p>Storage kept by the phone: {kept}</p>
      {MODEL_FILES.length > 0 && (
        <p><a href="#/scan-speed">Scan speed test</a> (how fast the scan model runs on this phone)</p>
      )}
      <h2>Credits</h2>
      <p>Photos from iNaturalist observers, each credited on its species page (CC0, CC BY or CC BY-NC). Facts from First
        Nature, Wild Food UK, Wikipedia, the Woodland Trust and NatureSpot, listed on each page. The scan models: BVRA, trained on
        the Danish Fungi 2020 and FungiTastic photos (CC BY-NC 4.0, non-commercial use). Maps: OpenFreeMap, with map data © OpenStreetMap
        contributors. Your finds are kept on this phone only.</p>
      <p class="muted small">OS grid references are worked out with geodesy, copyright (c) 2014 Chris Veness, MIT licence:
        permission is granted, free of charge, to use, copy, modify and distribute it, provided this notice is kept; it is
        provided "as is", without warranty of any kind. Plus Codes follow Google's open Open Location Code
        (Apache License 2.0).</p>
    </>
  );
}
