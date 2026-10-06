export type TestObservation = {
  id: number;
  user?: { login: string };
  observed_on?: string | null;
  photos: Array<{ id: number; license_code: string | null; url: string }>;
};
export type PickedTest = { obsId: number; month: number; urls: string[] };

const OPEN = new Set(['cc0', 'cc-by', 'cc-by-nc', 'cc-by-sa', 'cc-by-nd', 'cc-by-nc-sa', 'cc-by-nc-nd']);

/** Up to `limit` observations, one per observer before a second from anyone, never one the guide shows; up to three
 * openly licensed photos each, as 500 px addresses. Test photos are only ever kept on the Mac. */
export function pickTestObservations(observations: TestObservation[], exclude: Set<number>, limit: number): PickedTest[] {
  const byObserver = new Map<string, PickedTest[]>();
  for (const o of observations) {
    if (exclude.has(o.id) || !o.observed_on) continue;
    const urls = o.photos.filter((p) => p.license_code && OPEN.has(p.license_code)).slice(0, 3)
      .map((p) => p.url.replace('/square.', '/medium.'));
    if (urls.length === 0) continue;
    const key = o.user?.login ?? `observation ${o.id}`;
    const list = byObserver.get(key) ?? [];
    list.push({ obsId: o.id, month: Number(o.observed_on.slice(5, 7)), urls });
    byObserver.set(key, list);
  }
  const queues = [...byObserver.values()];
  const out: PickedTest[] = [];
  for (let round = 0; out.length < limit; round++) {
    let took = false;
    for (const q of queues) {
      if (round < q.length && out.length < limit) { out.push(q[round]); took = true; }
    }
    if (!took) break;
  }
  return out;
}
