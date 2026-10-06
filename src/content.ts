import type { SpeciesRecord } from './types';
import { loadAll } from './species';

const modules = import.meta.glob<{ default: SpeciesRecord }>('../content/species/*.json', { eager: true });
export const ALL_SPECIES = loadAll(modules);
export const photoUrl = (file: string) => `${import.meta.env.BASE_URL}${file}`;
