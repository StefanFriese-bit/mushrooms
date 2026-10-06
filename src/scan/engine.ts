import { pixels, type Fit, type Photo } from './prepare';

// The photo model on the phone (spec 6.1): onnxruntime-web, single-threaded WebAssembly (GitHub Pages cannot send
// the headers that threads need), loaded on the first scan and kept. The model file and the engine file are stored
// by the service worker when the app is first opened, so the scan works with no signal.
export type Engine = { score: (photo: Photo) => Promise<Float32Array> };
let loading: Promise<Engine> | null = null;

export function loadEngine(file: string, size: number, fit: Fit): Promise<Engine> {
  loading ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    // The engine file's full address and nothing else: the runner then uses the glue code built into it (given a
    // folder instead, it fetches a second file, ort-wasm-simd-threaded.mjs, from there).
    ort.env.wasm.wasmPaths = { wasm: new URL(`${import.meta.env.BASE_URL}ort/ort-wasm-simd-threaded.wasm`, location.href).href };
    ort.env.wasm.numThreads = 1;
    const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
    if (!res.ok) throw new Error(`the model file answered ${res.status}`);
    const session = await ort.InferenceSession.create(await res.arrayBuffer(), { executionProviders: ['wasm'] });
    return {
      score: async (photo: Photo) => {
        const input = new ort.Tensor('float32', pixels(photo, size, fit), [1, 3, size, size]);
        const out = await session.run({ pixels: input });
        return out.probabilities.data as Float32Array;
      },
    };
  })();
  loading.catch(() => { loading = null; }); // a failed load is tried again next time
  return loading;
}

/** A photo file decoded upright, ready to draw. */
export async function decode(file: Blob): Promise<Photo & { url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, url };
}
