// A polite client for iNaturalist's public API: one request at a time, at least minGapMs apart, retries only
// on 429 and 5xx. iNaturalist asks for <= 60 requests a minute and < 10,000 a day.
export const API = 'https://api.inaturalist.org/v1';
export const USER_AGENT =
  'mushrooms content builder (personal, non-commercial; https://github.com/StefanFriese-bit/mushrooms)';

export type InatTaxon = {
  id: number;
  name: string;
  rank: string;
  ancestor_ids: number[];
  is_active?: boolean;
  preferred_common_name?: string | null;
  default_photo?: { square_url?: string | null; attribution?: string | null; license_code?: string | null } | null;
};

export type SpeciesCount = { count: number; taxon: InatTaxon };

export type HttpResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<HttpResponse>;

export type InatClientOptions = {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minGapMs?: number;
  maxTries?: number;
};

export type InatClient = ReturnType<typeof createInatClient>;

export function createInatClient(opts: InatClientOptions = {}) {
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? (() => Date.now());
  const minGapMs = opts.minGapMs ?? 1100;
  const maxTries = opts.maxTries ?? 4;
  let lastStart = Number.NEGATIVE_INFINITY;

  async function getJson(path: string): Promise<any> {
    const url = `${API}${path}`;
    for (let attempt = 1; ; attempt++) {
      const wait = lastStart + minGapMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      const res = await doFetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxTries) {
        throw new Error(`iNaturalist answered HTTP ${res.status} for ${url} (attempt ${attempt} of ${maxTries})`);
      }
      await sleep(minGapMs * 4 * 2 ** (attempt - 1));
    }
  }

  async function speciesCounts(placeId: number, taxonId: number): Promise<SpeciesCount[]> {
    const all: SpeciesCount[] = [];
    for (let page = 1; page <= 20; page++) {
      const q = new URLSearchParams({
        place_id: String(placeId),
        taxon_id: String(taxonId),
        quality_grade: 'research',
        hrank: 'species',
        lrank: 'species',
        per_page: '500',
        page: String(page),
      });
      const body = await getJson(`/observations/species_counts?${q}`);
      const results: SpeciesCount[] = body.results ?? [];
      all.push(...results);
      if (results.length === 0 || all.length >= (body.total_results ?? 0)) return all;
    }
    throw new Error(`More than 20 pages of species for taxon ${taxonId}; check the query`);
  }

  async function resolveTaxon(name: string, rank: string): Promise<InatTaxon> {
    const q = new URLSearchParams({ q: name, rank, per_page: '30' });
    const body = await getJson(`/taxa?${q}`);
    const exact = (body.results ?? []).filter(
      (t: InatTaxon) => t.name === name && t.rank === rank && t.is_active !== false,
    );
    if (exact.length !== 1) {
      throw new Error(`Expected one active ${rank} called "${name}" on iNaturalist, found ${exact.length}`);
    }
    return exact[0];
  }

  return { getJson, speciesCounts, resolveTaxon };
}
