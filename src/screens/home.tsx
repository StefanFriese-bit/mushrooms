import { SECTIONS, onSectionTap, sectionHref } from '../sections';
import { freshDogs, sayDogsWhen } from '../finds/dogs';
import { Icon } from './icons';

// Home (Stefan 10/10/2026): the sections and nothing else, the Map first and largest — "the most important space".
// Dogs (13/10/2026) says under its name what a tap does: save where he tied them, or take him back to them.
export function Home() {
  const dogs = freshDogs();
  const sub = (name: string) => (name !== 'dogs' ? null
    : dogs ? `Take me back to them · saved ${sayDogsWhen(dogs.at)}` : 'Save where you tied them');
  return (
    <>
      <h1 class="visually-hidden">Home</h1>
      <nav class="home-buttons" aria-label="Sections" data-test="home">
        {SECTIONS.map((s, i) => (
          <a key={s.name} class={`home-button${i === 0 ? ' main' : ''}`} href={sectionHref(s.name)} data-test={`home-${s.name}`}
            onClick={onSectionTap}>
            <span class="home-icon"><Icon name={s.icon} size={i === 0 ? 30 : 26} /></span>
            <span class="home-text">
              <span class="home-label">{s.label}</span>
              {sub(s.name) && <small class="home-sub" data-test={`home-${s.name}-sub`}>{sub(s.name)}</small>}
            </span>
            <Icon name="chevron" size={20} />
          </a>
        ))}
      </nav>
    </>
  );
}
