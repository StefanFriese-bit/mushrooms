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
      <p class="card">Test version — not for identifying mushrooms. Never eat a mushroom on this app's word.</p>
      <p>{ALL_SPECIES.length} sample species. Built {__BUILD_DATE__}.</p>
      <p>Storage kept by the phone: {kept}</p>
      {MODEL_FILES.length > 0 && (
        <p><a href="#/scan-speed">Scan speed test</a> (for the test version: how fast the scan model runs on this phone)</p>
      )}
      <h2>Credits</h2>
      <p>Photos from iNaturalist observers, each credited on its species page (CC0, CC BY or CC BY-NC). Facts from First
        Nature, Wild Food UK, Wikipedia and the Woodland Trust, listed on each page. The scan models: BVRA, trained on
        the Danish Fungi 2020 photos (CC BY-NC 4.0, non-commercial use).</p>
    </>
  );
}
