import { useEffect, useMemo, useState } from 'preact/hooks';
import { Cropper } from './crop';
import { Icon } from './icons';

// The five photo slots (Stefan 10/10/2026: top of the cap, underneath, the stem, the base of the stem and a cross-section;
// any one is enough): each chosen photo opens the crop screen, and a tap on it crops it again from the whole photo. The
// Scan and Identify's photos use the same slots.
export const SLOTS = ['Top of the cap', 'Underneath', 'Stem', 'Base of the stem', 'Cross-section'] as const;

/** The photos as cropped, and as chosen (kept so a crop can be done again from the whole photo). */
export type Slots = { files: Array<File | null>; originals: Array<File | null> };
export const noPhotos = (): Slots => ({ files: SLOTS.map(() => null), originals: SLOTS.map(() => null) });
export const photosIn = (s: Slots): File[] => s.files.filter((f): f is File => f !== null);

export function PhotoSlots({ slots, onChange }: { slots: Slots; onChange: (s: Slots) => void }) {
  const [cropping, setCropping] = useState<{ slot: number; file: File } | null>(null);
  const previews = useMemo(() => slots.files.map((f) => (f ? URL.createObjectURL(f) : null)), [slots.files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  const put = (i: number, file: File | null, original: File | null) => onChange({
    files: slots.files.map((f, k) => (k === i ? file : f)),
    originals: slots.originals.map((f, k) => (k === i ? original : f)),
  });
  return (
    <>
      <div class="slots">
        {SLOTS.map((label, i) => (
          <figure class="slot" key={label} data-test="slot">
            {previews[i] ? (
              // Tap the photo to crop it again, from the whole photo.
              <button type="button" class="slot-photo" aria-label={`Crop the ${label.toLowerCase()} photo again`}
                onClick={() => setCropping({ slot: i, file: slots.originals[i] ?? slots.files[i]! })}>
                <img src={previews[i]!} alt={label} /><span class="slot-crop"><Icon name="crop" size={16} /></span>
              </button>
            ) : <span class="slot-empty">+</span>}
            <figcaption>{label}</figcaption>
            {slots.files[i] ? (
              <button type="button" class="small-button" onClick={() => put(i, null, null)}>Remove</button>
            ) : (
              <label class="small-button file-button">Add<input type="file" accept="image/*" aria-label={`${label} photo`}
                onChange={(e) => {
                  const input = e.target as HTMLInputElement;
                  const f = input.files?.[0] ?? null;
                  input.value = '';
                  if (f) setCropping({ slot: i, file: f });
                }} />
              </label>
            )}
          </figure>
        ))}
      </div>
      {cropping && (
        <Cropper file={cropping.file} label={SLOTS[cropping.slot]} onCancel={() => setCropping(null)}
          onDone={(cropped) => { put(cropping.slot, cropped, cropping.file); setCropping(null); }} />
      )}
    </>
  );
}
