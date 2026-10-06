export type Reason = 'edible' | 'dangerous-lookalike' | 'deadly' | 'most-recorded' | 'added-by-stefan';
export type Level = 'deadly' | 'poisonous';

export type Candidate = {
  inatId: number;
  name: string;
  ukRecords: number;
  inatEnglish: string | null;
  photo: { url: string; attribution: string } | null;
};

export type Picked = Candidate & { reasons: Reason[]; dangerLevel: Level | null };

export type SelectInput = {
  ranked: Candidate[];
  core: Map<string, Candidate>;
  edibles: string[];
  dangerous: Array<{ name: string; level: Level }>;
  lookalikeNames: Set<string>;
  add: Map<string, Candidate>;
  remove: string[];
  target: number;
};

export function selectSpecies(input: SelectInput): { picked: Picked[]; notes: string[] } {
  const notes: string[] = [];
  const picked = new Map<string, Picked>();
  const neverRemove = new Set<string>();

  const put = (c: Candidate, reason: Reason, level: Level | null = null) => {
    const p = picked.get(c.name) ?? { ...c, reasons: [], dangerLevel: null };
    if (!p.reasons.includes(reason)) p.reasons.push(reason);
    if (level) p.dangerLevel = level;
    picked.set(c.name, p);
  };
  const coreOf = (name: string): Candidate => {
    const c = input.core.get(name);
    if (!c) throw new Error(`Core species "${name}" was not resolved on iNaturalist`);
    return c;
  };

  for (const name of input.edibles) put(coreOf(name), 'edible');
  for (const d of input.dangerous) {
    const c = coreOf(d.name);
    if (input.lookalikeNames.has(d.name)) put(c, 'dangerous-lookalike', d.level);
    if (d.level === 'deadly') put(c, 'deadly', d.level);
    neverRemove.add(d.name);
  }
  for (const c of input.add.values()) put(c, 'added-by-stefan');

  const removing = new Set<string>();
  for (const name of input.remove) {
    if (neverRemove.has(name)) notes.push(`Kept ${name}: dangerous lookalikes and deadly species always stay in the guide.`);
    else removing.add(name);
  }
  for (const name of removing) picked.delete(name);

  const ranked = [...input.ranked].sort((a, b) => b.ukRecords - a.ukRecords || a.name.localeCompare(b.name));
  for (const c of ranked) {
    if (picked.size >= input.target) break;
    if (picked.has(c.name) || removing.has(c.name)) continue;
    put(c, 'most-recorded');
  }

  if (picked.size < input.target) notes.push(`Only ${picked.size} species available for a target of ${input.target}.`);
  for (const p of picked.values()) {
    if (p.ukRecords === 0) notes.push(`${p.name} has no UK research-grade records on iNaturalist; it is in for safety.`);
  }
  return { picked: [...picked.values()], notes };
}
