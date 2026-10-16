import { BADGES, type Badge, type BadgeKey } from '../finds/badges';

/** One of the three pictures (src/finds/badges.ts). */
export function BadgeIcon({ badge, size = 32 }: { badge: Badge; size?: number }) {
  return <span class="badge-icon" style={{ width: `${size}px`, height: `${size}px` }} dangerouslySetInnerHTML={{ __html: badge.svg }} />;
}

/** A location's pictures side by side (two mushrooms found together = two); nothing when it has none. */
export function BadgeIcons({ badges, size = 32 }: { badges: Badge[]; size?: number }) {
  if (!badges.length) return null;
  return <span class="badge-icons">{badges.map((b) => <BadgeIcon key={b.key} badge={b} size={size} />)}</span>;
}

/** The pictures as buttons: the chosen one stays pressed; a tap on it again takes it back. */
export function BadgePicker({ value, onPick }: { value: BadgeKey | null; onPick: (key: BadgeKey | null) => void }) {
  return (
    <div class="badge-pick" role="group" aria-label="What you found" data-test="badge-pick">
      {BADGES.map((b) => (
        <button type="button" key={b.key} class="badge-choice" aria-pressed={value === b.key} data-badge={b.key}
          onClick={() => onPick(value === b.key ? null : b.key)}>
          <BadgeIcon badge={b} size={40} />
          <span>{b.name}</span>
        </button>
      ))}
    </div>
  );
}
