import { Icon } from './icons';

// A way back up, at the top of a page under the band (Stefan 10/10/2026, on Take me there: "how do I go back to just
// the map"): one tap, always to the same place, so it works the same however he arrived.
export function BackLink({ href, label }: { href: string; label: string }) {
  return <a class="back-link" href={href} data-test="back-link"><Icon name="back" size={18} />{label}</a>;
}
