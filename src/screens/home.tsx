import { SECTIONS, sectionHref } from '../sections';
import { Icon } from './icons';

// Home (Stefan 10/10/2026): the four sections and nothing else, the Map first and largest — "the most important space".
export function Home() {
  return (
    <>
      <h1 class="visually-hidden">Home</h1>
      <nav class="home-buttons" aria-label="Sections" data-test="home">
        {SECTIONS.map((s, i) => (
          <a key={s.name} class={`home-button${i === 0 ? ' main' : ''}`} href={sectionHref(s.name)} data-test={`home-${s.name}`}>
            <span class="home-icon"><Icon name={s.icon} size={i === 0 ? 30 : 26} /></span>
            <span class="home-label">{s.label}</span>
            <Icon name="chevron" size={20} />
          </a>
        ))}
      </nav>
    </>
  );
}
