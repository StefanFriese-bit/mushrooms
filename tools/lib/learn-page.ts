import { hostOf } from './core-lists.ts';

export type LearnSection = { title: string; points: string[]; sources: Array<{ title: string; url: string }> };

/** Every problem with the Learn page, in words: each section has points and two allowed websites; never "safe". */
export function checkLearn(sections: LearnSection[], allowedHosts: string[]): string[] {
  const out: string[] = [];
  const allowed = new Set(allowedHosts.map((h) => h.replace(/^www\./, '')));
  for (const s of sections) {
    const say = (m: string) => out.push(`Learn "${s.title}": ${m}`);
    if (s.points.length === 0) say('has no points');
    const hosts = new Set<string>();
    for (const src of s.sources) {
      const h = hostOf(src.url);
      if (!h || !allowed.has(h)) say(`${h ?? src.url} is not on the allowed list`);
      else hosts.add(h);
    }
    if (hosts.size < 2) say(`needs sources from two different websites (has ${hosts.size})`);
    if (/\bsafe\b/i.test(JSON.stringify([s.title, s.points]))) say('uses the word "safe"');
  }
  return out;
}
