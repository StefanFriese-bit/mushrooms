import { describe, expect, it } from 'vitest';
import { createInatClient, type HttpResponse } from '../tools/lib/inat.ts';

function fakeHttp(responses: Array<{ status: number; body?: unknown }>) {
  const calls: string[] = [];
  const fetch = async (url: string): Promise<HttpResponse> => {
    calls.push(url);
    const next = responses.shift();
    if (!next) throw new Error('no more fake responses');
    return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
  };
  return { fetch, calls };
}

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const ok = (body: unknown) => ({ status: 200, body });

describe('inat client', () => {
  it('keeps requests at least minGapMs apart', async () => {
    const http = fakeHttp([ok({}), ok({})]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100 });
    await client.getJson('/a');
    await client.getJson('/b');
    expect(clock.sleeps).toEqual([1100]);
  });

  it('retries a 429 after a back-off, then succeeds', async () => {
    const http = fakeHttp([{ status: 429 }, ok({ fine: true })]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100 });
    await expect(client.getJson('/a')).resolves.toEqual({ fine: true });
    expect(http.calls).toHaveLength(2);
    expect(clock.sleeps).toEqual([4400]);
  });

  it('retries a dropped connection like a busy answer, then succeeds', async () => {
    let n = 0;
    const fetch = async (): Promise<HttpResponse> => {
      n++;
      if (n < 3) throw new TypeError('fetch failed');
      return { ok: true, status: 200, json: async () => ({ fine: true }) };
    };
    const clock = fakeClock();
    const client = createInatClient({ fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100 });
    await expect(client.getJson('/a')).resolves.toEqual({ fine: true });
    expect(n).toBe(3);
  });

  it('gives up on a connection that keeps dropping, naming the address', async () => {
    const fetch = async (): Promise<HttpResponse> => { throw new TypeError('fetch failed'); };
    const clock = fakeClock();
    const client = createInatClient({ fetch, now: clock.now, sleep: clock.sleep, maxTries: 3 });
    await expect(client.getJson('/taxa/1')).rejects.toThrow(/no answer.*\/taxa\/1.*attempt 3 of 3/);
  });

  it('does not retry a 404', async () => {
    const http = fakeHttp([{ status: 404 }]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.getJson('/a')).rejects.toThrow(/HTTP 404/);
    expect(http.calls).toHaveLength(1);
  });

  it('gives up after maxTries server errors', async () => {
    const http = fakeHttp([{ status: 500 }, { status: 502 }, { status: 503 }, { status: 500 }]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100, maxTries: 4 });
    await expect(client.getJson('/a')).rejects.toThrow(/attempt 4 of 4/);
    expect(clock.sleeps).toEqual([4400, 8800, 17600]);
  });

  it('pages through species counts until total_results is reached', async () => {
    const t = (id: number) => ({ id, name: `Genus s${id}`, rank: 'species', ancestor_ids: [1, id] });
    const http = fakeHttp([
      ok({ total_results: 3, results: [{ count: 9, taxon: t(1) }, { count: 8, taxon: t(2) }] }),
      ok({ total_results: 3, results: [{ count: 7, taxon: t(3) }] }),
    ]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    const counts = await client.speciesCounts(6857, 50814);
    expect(counts.map((c) => c.taxon.id)).toEqual([1, 2, 3]);
    expect(http.calls[0]).toContain('place_id=6857');
    expect(http.calls[0]).toContain('taxon_id=50814');
    expect(http.calls[0]).toContain('quality_grade=research');
    expect(http.calls[0]).toContain('hrank=species');
    expect(http.calls[0]).toContain('page=1');
    expect(http.calls[1]).toContain('page=2');
  });

  it('resolves a name to exactly one active taxon of that rank', async () => {
    const http = fakeHttp([
      ok({
        results: [
          { id: 1, name: 'Xylariales', rank: 'order', ancestor_ids: [], is_active: true },
          { id: 2, name: 'Xylariales', rank: 'order', ancestor_ids: [], is_active: false },
          { id: 3, name: 'Xylariaceae', rank: 'family', ancestor_ids: [], is_active: true },
        ],
      }),
    ]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.resolveTaxon('Xylariales', 'order')).resolves.toMatchObject({ id: 1 });
  });

  it('refuses a name that matches no taxon, or two', async () => {
    const two = { id: 1, name: 'A b', rank: 'species', ancestor_ids: [], is_active: true };
    const http = fakeHttp([ok({ results: [] }), ok({ results: [two, { ...two, id: 2 }] })]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.resolveTaxon('A b', 'species')).rejects.toThrow(/found 0/);
    await expect(client.resolveTaxon('A b', 'species')).rejects.toThrow(/found 2/);
  });

  it("lists a taxon's other scientific names (older names), not its own", async () => {
    const http = fakeHttp([
      ok({
        results: [
          {
            id: 7,
            name: 'Collybia nuda',
            names: [
              { name: 'Collybia nuda', lexicon: 'scientific-names', is_valid: true },
              { name: 'Lepista nuda', lexicon: 'scientific-names', is_valid: false },
              { name: 'Wood Blewit', lexicon: 'english', is_valid: true },
            ],
          },
        ],
      }),
    ]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.olderNames(7)).resolves.toEqual(['Lepista nuda']);
    expect(http.calls[0]).toContain('/taxa/7?all_names=true');
  });
});

