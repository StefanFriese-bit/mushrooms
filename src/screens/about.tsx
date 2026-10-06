import { useEffect, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { keepData } from '../storage';

export function About() {
  const [kept, setKept] = useState<string>('checking…');
  useEffect(() => { keepData().then(setKept); }, []);
  return (
    <>
      <h1>About</h1>
      <p class="card">Test version — not for identifying mushrooms. Never eat a mushroom on this app's word.</p>
      <p>{ALL_SPECIES.length} sample species. Built {__BUILD_DATE__}.</p>
      <p>Storage kept by the phone: {kept}</p>
      <h2>Credits</h2>
      <p>Photos from iNaturalist observers, each credited on its species page (CC0, CC BY or CC BY-NC). Facts from First
        Nature, Wild Food UK, Wikipedia and the Woodland Trust, listed on each page.</p>
    </>
  );
}
