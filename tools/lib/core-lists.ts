export type DangerLevel = 'deadly' | 'poisonous';
type Sourced = { sources: string[] };

export type CoreLists = {
  allowedSourceHosts: string[];
  edibles: Array<{ name: string } & Sourced>;
  dangerous: Array<{ name: string; level: DangerLevel } & Sourced>;
  pairs: Array<{ edible: string; dangerous: string } & Sourced>;
  noDangerousLookalike: Array<{ edible: string } & Sourced>;
};

const BINOMIAL = /^[A-Z][a-z]+ [a-z][a-z-]+$/;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Every problem, in words. An empty list means the lists may be used. */
export function validateCoreLists(c: CoreLists): string[] {
  const problems: string[] = [];
  const allowed = new Set(c.allowedSourceHosts.map((h) => h.replace(/^www\./, '')));

  const checkSources = (what: string, sources: string[]) => {
    const hosts = new Set<string>();
    for (const s of sources) {
      const h = hostOf(s);
      if (!h) problems.push(`${what}: "${s}" is not a web address`);
      else if (!allowed.has(h)) problems.push(`${what}: ${h} is not on the allowed source list`);
      else hosts.add(h);
    }
    if (hosts.size < 2) problems.push(`${what}: needs two sources from different websites (has ${hosts.size})`);
  };

  const namesOf = (list: Array<{ name: string }>, label: string) => {
    const seen = new Set<string>();
    for (const e of list) {
      if (!BINOMIAL.test(e.name)) problems.push(`${label} "${e.name}": not a "Genus species" name`);
      if (seen.has(e.name)) problems.push(`${label} "${e.name}": listed twice`);
      seen.add(e.name);
    }
    return seen;
  };

  const edibles = namesOf(c.edibles, 'edible');
  const dangerous = namesOf(c.dangerous, 'dangerous');
  for (const n of edibles) if (dangerous.has(n)) problems.push(`"${n}" is in both the edible and the dangerous list`);

  for (const e of c.edibles) checkSources(`edible "${e.name}"`, e.sources);
  for (const d of c.dangerous) {
    if (d.level !== 'deadly' && d.level !== 'poisonous') {
      problems.push(`dangerous "${d.name}": level must be deadly or poisonous`);
    }
    checkSources(`dangerous "${d.name}"`, d.sources);
  }

  const pairKeys = new Set<string>();
  for (const p of c.pairs) {
    const what = `pair "${p.edible}" / "${p.dangerous}"`;
    if (!edibles.has(p.edible)) problems.push(`${what}: "${p.edible}" is not in the edible list`);
    if (!dangerous.has(p.dangerous)) problems.push(`${what}: "${p.dangerous}" is not in the dangerous list`);
    const key = `${p.edible}|${p.dangerous}`;
    if (pairKeys.has(key)) problems.push(`${what}: listed twice`);
    pairKeys.add(key);
    checkSources(what, p.sources);
  }

  const noLookalike = new Set<string>();
  for (const n of c.noDangerousLookalike) {
    const what = `no-dangerous-lookalike "${n.edible}"`;
    if (!edibles.has(n.edible)) problems.push(`${what}: not in the edible list`);
    noLookalike.add(n.edible);
    checkSources(what, n.sources);
  }

  const edibleInAPair = new Set(c.pairs.map((p) => p.edible));
  const dangerousInAPair = new Set(c.pairs.map((p) => p.dangerous));
  for (const e of c.edibles) {
    if (edibleInAPair.has(e.name) && noLookalike.has(e.name)) {
      problems.push(`edible "${e.name}": has lookalikes AND is marked as having none`);
    }
    if (!edibleInAPair.has(e.name) && !noLookalike.has(e.name)) {
      problems.push(`edible "${e.name}": name its dangerous lookalikes, or mark it as having none (with two sources)`);
    }
  }
  for (const d of c.dangerous) {
    if (d.level === 'poisonous' && !dangerousInAPair.has(d.name)) {
      problems.push(`dangerous "${d.name}": a poisonous species belongs here only as a lookalike of an edible one`);
    }
  }
  return problems;
}
