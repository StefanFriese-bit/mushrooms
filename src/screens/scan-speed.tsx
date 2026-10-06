import { useState } from 'preact/hooks';
import { photoUrl } from '../content';
import { MODEL_FILES, type ModelFile } from '../scan/model-files';
import { pixels } from '../scan/prepare';

// A hidden test page (spec 6.1): how fast the scan model runs on this phone, with WebGPU or plain WebAssembly. It
// fetches a model only when a button is pressed and keeps nothing.
type Engine = 'webgpu' | 'wasm';
type Run = { model: string; engine: Engine; mb: number; loadMs: number; oneMs: number; scanMs: number; top: string[] };
const SAMPLE = 'photos/deathcap/1.webp';

/** The guide photo, decoded, ready to draw. */
async function photo(url: string) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight };
}

async function measure(model: ModelFile, engine: Engine): Promise<Run> {
  const ort = engine === 'webgpu' ? await import('onnxruntime-web/webgpu') : await import('onnxruntime-web/wasm');
  ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
  ort.env.wasm.numThreads = 1; // GitHub Pages cannot send the headers that threads need
  const started = performance.now();
  const bytes = await (await fetch(`${import.meta.env.BASE_URL}${model.file}`)).arrayBuffer();
  const session = await ort.InferenceSession.create(bytes, { executionProviders: [engine] });
  const loadMs = performance.now() - started;
  const input = new ort.Tensor('float32', pixels(await photo(photoUrl(SAMPLE)), model.size, model.fit), [1, 3, model.size, model.size]);
  let t = performance.now();
  const first = await session.run({ pixels: input });
  const oneMs = performance.now() - t;
  t = performance.now();
  for (let k = 0; k < 3; k++) await session.run({ pixels: input });
  const scanMs = performance.now() - t;
  const probs = first.probabilities.data as Float32Array;
  const classes = (await import('../../content/model/df20-classes.json')).default.classes;
  const english = new Map((await import('../../content/species-list.json')).default.species.map((s) => [s.name, s.english]));
  const top = [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 3).map((i) => {
    const ours = classes[i].ours;
    return `${(ours && english.get(ours)) ?? classes[i].name} ${Math.round(probs[i] * 100)}%`;
  });
  await session.release();
  return { model: model.label, engine, mb: bytes.byteLength / 1e6, loadMs, oneMs, scanMs, top };
}

export function ScanSpeed() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async (model: ModelFile, engine: Engine) => {
    setBusy(`${model.label}, ${engine === 'webgpu' ? 'WebGPU' : 'WebAssembly'}`);
    setError(null);
    try {
      const r = await measure(model, engine);
      setRuns((rs) => [...rs, r]);
    } catch (e) {
      setError(`${model.label} with ${engine}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  return (
    <>
      <h1>Scan speed test</h1>
      <p>Times the scan model on this phone, using the Deathcap's guide photo. Each button downloads its model once
        (a few MB) — use Wi-Fi. This phone {gpu ? 'offers' : 'does not offer'} WebGPU.</p>
      {MODEL_FILES.map((m) => (
        <div class="card" key={m.file}>
          <h2>{m.label}</h2>
          <p>
            <button type="button" disabled={busy !== null || !gpu} onClick={() => go(m, 'webgpu')}>Run with WebGPU</button>{' '}
            <button type="button" disabled={busy !== null} onClick={() => go(m, 'wasm')}>Run with WebAssembly</button>
          </p>
        </div>
      ))}
      {busy && <p role="status">Running {busy}…</p>}
      {error && <p class="card" role="alert">{error}</p>}
      {runs.length > 0 && (
        <table class="apart" data-test="speed-results">
          <thead><tr><th>Model</th><th>Engine</th><th>Load</th><th>1 photo</th><th>3-photo scan</th><th>Top three</th></tr></thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={i}>
                <td>{r.model} ({r.mb.toFixed(1)} MB)</td>
                <td>{r.engine === 'webgpu' ? 'WebGPU' : 'WebAssembly'}</td>
                <td>{(r.loadMs / 1000).toFixed(1)} s</td>
                <td>{(r.oneMs / 1000).toFixed(2)} s</td>
                <td data-test="scan-seconds">{(r.scanMs / 1000).toFixed(2)} s</td>
                <td>{r.top.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
