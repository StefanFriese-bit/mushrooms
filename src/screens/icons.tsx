import type { JSX } from 'preact';

// Line icons drawn for this app (24 × 24, in the colour of the text around them): no icon font and no outside file,
// so they show with no signal and need no licence notice.
const SHAPES = {
  map: <><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z" /><path d="M9 4v14M15 6v14" /></>,
  pin: <><path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.4" /></>,
  'pin-plus': <><path d="M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" /><path d="M12 7v5.6M9.2 9.8h5.6" /></>,
  scan: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.6-2.2h5.4L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.8" r="3.4" /></>,
  guide: <><path d="M12 6.6C10.3 5.2 7.9 4.6 4 4.8v13.4c3.9-.2 6.3.4 8 1.8 1.7-1.4 4.1-2 8-1.8V4.8c-3.9-.2-6.3.4-8 1.8z" /><path d="M12 6.6V20" /></>,
  identify: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /><path d="M8.7 8.8a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M10.5 13.9v.1" /></>,
  learn: <><path d="M9.2 18h5.6M10.2 21h3.6" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.5.9 1.2.9 1.9v.5h5.8v-.5c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z" /></>,
  home: <><path d="M3.5 10.6 12 3.8l8.5 6.8" /><path d="M5.6 9.2V20h12.8V9.2" /><path d="M10 20v-5.4h4V20" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.8v5.6M12 7.6v.1" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  navigate: <path d="M12 3.2 19.2 20 12 16.2 4.8 20z" />,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.6-2.2h5.4L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.8" r="3.4" /><path d="M12 11.1v3.4M10.3 12.8h3.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  crop: <><path d="M6 2.5V18h15.5" /><path d="M2.5 6H18v15.5" /></>,
} satisfies Record<string, JSX.Element>;
export type IconName = keyof typeof SHAPES;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  );
}
