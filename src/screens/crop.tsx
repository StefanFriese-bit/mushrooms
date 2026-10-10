import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_ZOOM, centred, clampView, outputSide, sourceRect, zoomAt, zoomOf, type View } from '../scan/crop';

// The crop screen (Stefan 10/10/2026): after a photo is chosen for a scan slot, he zooms in on the part that matters —
// the cap, say — by pinching or with the slider, and drags it into the square. What is inside the square is what the
// scan looks at. The rules are in src/scan/crop.ts; this only turns fingers into them.
type Point = { x: number; y: number };
type Props = { file: Blob; label: string; onDone: (cropped: File) => void; onCancel: () => void };

export function Cropper({ file, label, onDone, onCancel }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [side, setSide] = useState(0); // the square's width, in screen points
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fingers = useRef(new Map<number, Point>());
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const i = new Image();
    i.src = url;
    i.decode().then(() => setImg(i), () => setProblem('This photo could not be read.'));
  }, [url]);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setSide(el.clientWidth);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const W = img?.naturalWidth ?? 1;
  const H = img?.naturalHeight ?? 1;
  useEffect(() => { if (img && side) setView(centred(W, H, side)); }, [img, side]);

  const at = (e: PointerEvent): Point => {
    const r = frame.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    fingers.current.set(e.pointerId, at(e));
  };
  const move = (e: PointerEvent) => {
    const all = fingers.current;
    if (!all.has(e.pointerId)) return;
    const before = [...all.values()].map((p) => ({ ...p }));
    all.set(e.pointerId, at(e));
    const after = [...all.values()];
    setView((v) => {
      if (!v) return v;
      if (after.length === 1) return clampView({ ...v, x: v.x + after[0].x - before[0].x, y: v.y + after[0].y - before[0].y }, W, H, side);
      // Two fingers: zoom by how far they moved apart, about their middle, and follow the middle as it moves.
      const mid = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const gap = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
      const m0 = mid(before);
      const m1 = mid(after);
      const z = zoomAt(v, gap(after) / gap(before), m0.x, m0.y, W, H, side);
      return clampView({ ...z, x: z.x + m1.x - m0.x, y: z.y + m1.y - m0.y }, W, H, side);
    });
  };
  const up = (e: PointerEvent) => { fingers.current.delete(e.pointerId); };
  const slide = (to: number) => setView((v) => (v ? zoomAt(v, to / zoomOf(v, W, H, side), side / 2, side / 2, W, H, side) : v));

  const use = async () => {
    if (!img || !view) return;
    setBusy(true);
    try {
      const r = sourceRect(view, side);
      const n = outputSide(r);
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('no canvas');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, n, n);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.92));
      if (!blob) throw new Error('no picture');
      onDone(new File([blob], 'cropped.jpg', { type: 'image/jpeg' }));
    } catch {
      setBusy(false);
      setProblem('The crop could not be made. Try again, or cancel and choose the photo again.');
    }
  };

  return (
    <div class="crop-sheet" role="dialog" aria-modal="true" aria-label={`Crop: ${label}`} data-test="cropper">
      <div class="crop-inner">
        <h2>Crop: {label}</h2>
        <p class="muted small">Pinch or use the slider to zoom in, and drag the photo. The scan looks at what is inside the square.</p>
        <div class="crop-frame" ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {img && view && (
            <img src={url} alt="" draggable={false} style={{ width: `${W * view.scale}px`, height: `${H * view.scale}px`,
              transform: `translate3d(${view.x}px, ${view.y}px, 0)` }} />
          )}
        </div>
        <label class="crop-zoom">
          <span>Zoom</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} aria-label="Zoom" disabled={!view}
            value={view ? zoomOf(view, W, H, side) : 1} onInput={(e) => slide(Number((e.target as HTMLInputElement).value))} />
        </label>
        {problem && <p class="card alert" role="alert">{problem}</p>}
        <div class="crop-actions">
          <button type="button" class="small-button" onClick={onCancel}>Cancel</button>
          <button type="button" class="big-button" disabled={!view || busy} onClick={use}>{busy ? 'Cropping…' : 'Use this'}</button>
        </div>
      </div>
    </div>
  );
}
