import {
  USER_AGENT,
  WIKIDATA_BATCH,
  WIKIPEDIA_BATCH,
  backoffMs,
  cacheFileName,
  chunk,
  collectSources,
  createClient,
  formatReport,
  isUsableCacheEntry,
  parseArgs,
  parseRetryAfter,
  parseTitles,
  parseWikidata,
  parseWikipedia,
  requestJson,
  wikidataUrl,
  wikipediaUrl,
} from '../lib/wordSources';

// No test touches the network: every request goes to a fake fetch.

type FakeReply = { status?: number; body?: unknown; headers?: Record<string, string>; badJson?: boolean; throws?: string };

function reply(r: FakeReply) {
  if (r.throws) throw new Error(r.throws);
  const status = r.status ?? 200;
  const headers = r.headers ?? {};
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (r.badJson) throw new SyntaxError('Unexpected token <');
      return r.body;
    },
  };
}

/** A fetch that plays back the given replies in order, and records the calls. */
function scripted(replies: FakeReply[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const next = replies.shift();
    if (!next) throw new Error('unexpected extra request');
    return reply(next);
  });
  return { fn: fn as unknown as typeof fetch, calls, left: () => replies.length };
}

/** A clock that only moves when the fake sleep is called. */
function fakeTime(start = 1_000_000) {
  let t = start;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
    waits,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const FETCHED_AT = new Date(1_000_000).toISOString();
const META = { apiUrl: 'https://example.test/api', fetchedAt: FETCHED_AT };

function wikiPage(title: string, extra: Record<string, unknown> = {}) {
  return {
    pageid: title.length * 7,
    ns: 0,
    title,
    extract: `${title} intro text.`,
    fullurl: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`,
    revisions: [{ revid: 1000 + title.length, timestamp: '2026-10-01T00:00:00Z' }],
    pageprops: { wikibase_item: `Q${title.length}` },
    ...extra,
  };
}

/** Answers Action API title batches and wbgetentities batches from the URL, like the real servers would. */
function wikiServer(opts: { missing?: string[] } = {}) {
  const urls: string[] = [];
  const fn = jest.fn(async (url: string) => {
    urls.push(url);
    const u = new URL(url);
    if (u.hostname === 'en.wikipedia.org') {
      const titles = (u.searchParams.get('titles') ?? '').split('|');
      const pages = titles.map((t) => (opts.missing?.includes(t) ? { title: t, missing: true } : wikiPage(t)));
      return reply({ body: { batchcomplete: true, query: { pages } } });
    }
    const ids = (u.searchParams.get('ids') ?? '').split('|');
    const entities = Object.fromEntries(
      ids.map((id) => [id, { id, type: 'item', lastrevid: 555, modified: '2026-10-02T00:00:00Z', labels: { en: { language: 'en', value: `Label ${id}` } } }]),
    );
    return reply({ body: { entities } });
  });
  return { fn: fn as unknown as typeof fetch, urls };
}

function memoryCache(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    store,
    read: (kind: string, key: string) => store.get(`${kind}/${key}`) ?? null,
    write: (kind: string, key: string, entry: unknown) => {
      store.set(`${kind}/${key}`, entry);
      return `${kind}/${key}`;
    },
  };
}

describe('chunk and parseTitles', () => {
  it('splits into chunks of at most the size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 20)).toEqual([]);
  });

  it('reads titles and Q-ids, skipping blanks, comments and repeats', () => {
    const out = parseTitles(['Diwali', '  ', '# festivals', 'Holi_(festival)', 'diwali ', 'q10434', 'Q10434', 'Diwali', 'Dilwale   Dulhania Le Jayenge']);
    expect(out.titles).toEqual(['Diwali', 'Holi (festival)', 'diwali', 'Dilwale Dulhania Le Jayenge']);
    expect(out.ids).toEqual(['Q10434']);
  });

  it('keeps digits, punctuation and non-Latin text in titles', () => {
    expect(parseTitles(['3 Idiots', 'Kuch Kuch Hota Hai!', 'दिवाली']).titles).toEqual(['3 Idiots', 'Kuch Kuch Hota Hai!', 'दिवाली']);
  });
});

describe('request URLs', () => {
  it('asks the Action API for intro extracts, redirects and revisions, with titles joined by |', () => {
    const u = new URL(wikipediaUrl(['Diwali', 'Holi (festival)']));
    expect(u.origin + u.pathname).toBe('https://en.wikipedia.org/w/api.php');
    expect(u.searchParams.get('titles')).toBe('Diwali|Holi (festival)');
    expect(u.searchParams.get('redirects')).toBe('1');
    expect(u.searchParams.get('exintro')).toBe('1');
    expect(u.searchParams.get('explaintext')).toBe('1');
    expect(u.searchParams.get('prop')).toContain('revisions');
    expect(u.searchParams.get('formatversion')).toBe('2');
  });

  it('asks wbgetentities for English and Hindi labels, aliases and sitelinks', () => {
    const u = new URL(wikidataUrl(['Q1', 'Q2']));
    expect(u.searchParams.get('action')).toBe('wbgetentities');
    expect(u.searchParams.get('ids')).toBe('Q1|Q2');
    expect(u.searchParams.get('languages')).toBe('en|hi');
    expect(u.searchParams.get('props')).toContain('aliases');
    expect(u.searchParams.get('props')).toContain('sitelinks');
    expect(u.searchParams.get('sitefilter')).toBe('enwiki|hiwiki');
  });

  it('uses the limits the APIs allow', () => {
    expect(WIKIPEDIA_BATCH).toBe(20);
    expect(WIKIDATA_BATCH).toBe(50);
  });
});

describe('backoff', () => {
  it('doubles from 2s and stops at a minute', () => {
    expect([0, 1, 2, 3, 4].map((a) => backoffMs(a))).toEqual([2000, 4000, 8000, 16000, 32000]);
    expect(backoffMs(10)).toBe(60000);
  });

  it('is never shorter than Retry-After', () => {
    expect(backoffMs(0, 30000)).toBe(30000);
    expect(backoffMs(3, 1000)).toBe(16000);
  });

  it('reads Retry-After as seconds or as an HTTP date, and ignores nonsense', () => {
    expect(parseRetryAfter('7', 0)).toBe(7000);
    expect(parseRetryAfter('0', 0)).toBe(0);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter(new Date(1_000).toUTCString(), 4_000)).toBe(0);
    expect(parseRetryAfter('soon', 0)).toBeNull();
    expect(parseRetryAfter('', 0)).toBeNull();
    expect(parseRetryAfter(null, 0)).toBeNull();
  });
});

describe('requestJson', () => {
  it('sends the generic User-Agent, with the repo URL and no personal data', async () => {
    const f = scripted([{ body: { ok: 1 } }]);
    const t = fakeTime();
    await requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now });
    expect(f.calls[0].headers['User-Agent']).toBe(USER_AGENT);
    expect(USER_AGENT).toContain('https://github.com/RosePinkDragon/fuzzy-waddle');
    expect(USER_AGENT).not.toMatch(/@/);
  });

  it('waits out a 429 for at least its Retry-After, then succeeds', async () => {
    const f = scripted([{ status: 429, headers: { 'retry-after': '9' } }, { body: { ok: 1 } }]);
    const t = fakeTime();
    await expect(requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now })).resolves.toEqual({ ok: 1 });
    expect(t.waits).toEqual([9000]);
  });

  it('backs off exponentially across repeated 5xx replies', async () => {
    const f = scripted([{ status: 503 }, { status: 500 }, { status: 502 }, { body: { ok: 1 } }]);
    const t = fakeTime();
    await requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now });
    expect(t.waits).toEqual([2000, 4000, 8000]);
  });

  it('retries after a network error', async () => {
    const f = scripted([{ throws: 'socket hang up' }, { body: { ok: 1 } }]);
    const t = fakeTime();
    await expect(requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now })).resolves.toEqual({ ok: 1 });
    expect(t.waits).toEqual([2000]);
  });

  it('treats a maxlag reply as retryable', async () => {
    const f = scripted([{ body: { error: { code: 'maxlag', info: 'waiting' } } }, { body: { ok: 1 } }]);
    const t = fakeTime();
    await expect(requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now })).resolves.toEqual({ ok: 1 });
    expect(t.waits).toEqual([2000]);
  });

  it('gives up after the retry limit with the reason, and does not sleep after the last try', async () => {
    const f = scripted([{ status: 429 }, { status: 429 }, { status: 429 }]);
    const t = fakeTime();
    await expect(requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now, maxRetries: 2 })).rejects.toMatchObject({
      reason: 'HTTP 429 (gave up after 2 retries)',
    });
    expect(f.calls).toHaveLength(3);
    expect(t.waits).toEqual([2000, 4000]);
  });

  it('does not retry other 4xx replies or bad JSON', async () => {
    const t = fakeTime();
    const notFound = scripted([{ status: 404 }]);
    await expect(requestJson('https://x.test/', { fetch: notFound.fn, sleep: t.sleep, now: t.now })).rejects.toMatchObject({ reason: 'HTTP 404' });
    const bad = scripted([{ badJson: true }]);
    await expect(requestJson('https://x.test/', { fetch: bad.fn, sleep: t.sleep, now: t.now })).rejects.toMatchObject({ reason: 'reply was not valid JSON' });
    expect(t.waits).toEqual([]);
  });

  it('does not wait out a Retry-After of more than five minutes', async () => {
    const f = scripted([{ status: 429, headers: { 'retry-after': '3600' } }]);
    const t = fakeTime();
    await expect(requestJson('https://x.test/', { fetch: f.fn, sleep: t.sleep, now: t.now })).rejects.toMatchObject({
      reason: expect.stringContaining('too long to wait'),
    });
    expect(t.waits).toEqual([]);
  });
});

describe('createClient', () => {
  it('leaves the delay between one request and the next, and none before the first', async () => {
    const f = scripted([{ body: 1 }, { body: 2 }, { body: 3 }]);
    const t = fakeTime();
    const client = createClient({ fetch: f.fn, sleep: t.sleep, now: t.now, delayMs: 1000 });
    await client.get('https://x.test/1');
    expect(t.waits).toEqual([]);
    await client.get('https://x.test/2');
    t.advance(400); // time already passed counts towards the delay
    await client.get('https://x.test/3');
    expect(t.waits).toEqual([1000, 600]);
    expect(client.requests).toBe(3);
  });
});

describe('parseWikipedia', () => {
  it('follows normalisation and redirects, and records the revision and Wikidata item', () => {
    const json = {
      query: {
        normalized: [{ from: 'diwali', to: 'Diwali' }],
        redirects: [
          { from: 'Deepavali', to: 'Diwali' },
          { from: 'Holi', to: 'Holi (festival)', tofragment: 'Origins' },
        ],
        pages: [wikiPage('Diwali'), wikiPage('Holi (festival)')],
      },
    };
    const { entries, notFetched } = parseWikipedia(json, ['diwali', 'Deepavali', 'Holi'], META);
    expect(notFetched).toEqual([]);
    expect(entries.map((e) => [e.requestedTitle, e.title, e.redirectedFrom])).toEqual([
      ['diwali', 'Diwali', null],
      ['Deepavali', 'Diwali', 'Deepavali'],
      ['Holi', 'Holi (festival)', 'Holi'],
    ]);
    expect(entries[2].redirectFragment).toBe('Origins');
    expect(entries[0]).toMatchObject({
      kind: 'wikipedia',
      url: 'https://en.wikipedia.org/wiki/Diwali',
      revisionId: 1006,
      revisionTime: '2026-10-01T00:00:00Z',
      fetchedAt: FETCHED_AT,
      wikidataId: 'Q6',
      extract: 'Diwali intro text.',
    });
    expect(entries[0].permalink).toBe('https://en.wikipedia.org/w/index.php?title=Diwali&oldid=1006');
  });

  it('lists missing, invalid and text-less pages with a reason, and invents nothing', () => {
    const json = {
      query: {
        pages: [{ title: 'Nope Page', missing: true }, { title: '|bad', invalid: true, invalidreason: 'bad characters' }, wikiPage('Empty', { extract: '  ' }), wikiPage('Fine')],
      },
    };
    const { entries, notFetched } = parseWikipedia(json, ['Nope Page', '|bad', 'Empty', 'Fine', 'Lost'], META);
    expect(entries.map((e) => e.title)).toEqual(['Fine']);
    expect(notFetched).toEqual([
      { kind: 'wikipedia', key: 'Nope Page', reason: 'page does not exist on English Wikipedia' },
      { kind: 'wikipedia', key: '|bad', reason: 'invalid title: bad characters' },
      { kind: 'wikipedia', key: 'Empty', reason: 'page has no intro text' },
      { kind: 'wikipedia', key: 'Lost', reason: 'not in the API reply' },
    ]);
  });

  it('throws on an API error and tolerates an empty reply', () => {
    expect(() => parseWikipedia({ error: { code: 'badvalue', info: 'nope' } }, ['A'], META)).toThrow('API error badvalue: nope');
    expect(parseWikipedia({}, ['A'], META).notFetched).toEqual([{ kind: 'wikipedia', key: 'A', reason: 'not in the API reply' }]);
  });

  it('handles titles with digits, punctuation and a slash', () => {
    const t = ['3 Idiots', 'AC/DC', 'Kuch Kuch Hota Hai!'];
    const { entries } = parseWikipedia({ query: { pages: t.map((x) => wikiPage(x)) } }, t, META);
    expect(entries.map((e) => e.title)).toEqual(t);
  });
});

describe('parseWikidata', () => {
  const entity = {
    type: 'item',
    id: 'Q10434',
    lastrevid: 2468,
    modified: '2026-10-03T00:00:00Z',
    labels: { en: { language: 'en', value: 'Diwali' }, hi: { language: 'hi', value: 'दीपावली' } },
    aliases: { en: [{ language: 'en', value: 'Deepavali' }], hi: [{ language: 'hi', value: 'दिवाली' }] },
    sitelinks: {
      enwiki: { site: 'enwiki', title: 'Diwali', url: 'https://en.wikipedia.org/wiki/Diwali' },
      hiwiki: { site: 'hiwiki', title: 'दीपावली', url: 'https://hi.wikipedia.org/wiki/दीपावली' },
    },
  };

  it('reads labels, Hindi aliases, sitelinks and the revision', () => {
    const { entries, notFetched } = parseWikidata({ entities: { Q10434: entity } }, ['Q10434'], META);
    expect(notFetched).toEqual([]);
    expect(entries[0]).toMatchObject({
      kind: 'wikidata',
      id: 'Q10434',
      url: 'https://www.wikidata.org/wiki/Q10434',
      revisionId: 2468,
      fetchedAt: FETCHED_AT,
      labels: { en: 'Diwali', hi: 'दीपावली' },
      aliases: { en: ['Deepavali'], hi: ['दिवाली'] },
    });
    expect(entries[0].sitelinks.hiwiki.title).toBe('दीपावली');
  });

  it('leaves out what is missing instead of making it up', () => {
    const bare = { id: 'Q5', type: 'item', lastrevid: 9 };
    const { entries } = parseWikidata({ entities: { Q5: bare } }, ['Q5'], META);
    expect(entries[0].labels).toEqual({ en: null, hi: null });
    expect(entries[0].aliases).toEqual({ en: [], hi: [] });
    expect(entries[0].sitelinks).toEqual({});
  });

  it('lists a missing entity, finds a redirected ID, and throws on an API error', () => {
    const out = parseWikidata({ entities: { Q1: { id: 'Q1', missing: '' }, Q10434: entity } }, ['Q1', 'Q99', 'Q10434'], META);
    expect(out.entries.map((e) => e.id)).toEqual(['Q10434']);
    expect(out.notFetched).toEqual([
      { kind: 'wikidata', key: 'Q1', reason: 'entity does not exist on Wikidata' },
      { kind: 'wikidata', key: 'Q99', reason: 'not in the API reply' },
    ]);
    const viaRedirect = parseWikidata({ entities: { Q10434: entity } }, ['Q10434'], META);
    expect(viaRedirect.entries[0].resolvedId).toBe('Q10434');
    expect(() => parseWikidata({ error: { code: 'no-such-entity' } }, ['Q1'], META)).toThrow('API error no-such-entity');
  });
});

describe('cache file names', () => {
  const hash = (s: string) => `h${s.length}`;

  it('keeps titles readable and safe for a file system', () => {
    expect(cacheFileName('Holi (festival)', hash)).toBe('Holi_(festival).json');
    expect(cacheFileName('AC/DC', hash)).toBe('AC%2FDC.json');
    expect(cacheFileName('.hidden', hash)).toBe('%2Ehidden.json');
    expect(cacheFileName('दिवाली', hash)).toMatch(/^%E0%A4.*\.json$/);
  });

  it('shortens very long titles with a hash so they stay distinct', () => {
    const name = cacheFileName('x'.repeat(300), hash);
    expect(name.length).toBeLessThan(130);
    expect(name).toBe(`${'x'.repeat(100)}-h300.json`);
  });

  it('only trusts entries with a URL and fetch time', () => {
    expect(isUsableCacheEntry({ kind: 'wikipedia', url: 'u', fetchedAt: 't' })).toBe(true);
    expect(isUsableCacheEntry({ kind: 'wikipedia', url: 'u' })).toBe(false);
    expect(isUsableCacheEntry(null)).toBe(false);
    expect(isUsableCacheEntry('text')).toBe(false);
  });
});

describe('collectSources', () => {
  const deps = (fetchFn: typeof fetch, cache = memoryCache(), t = fakeTime()) => ({ fetch: fetchFn, sleep: t.sleep, now: t.now, cache, delayMs: 1000 });

  it('sends 20 titles per request, then one Wikidata batch for the items behind them', async () => {
    const titles = Array.from({ length: 45 }, (_, i) => `Page ${i + 1}`);
    const server = wikiServer();
    const cache = memoryCache();
    const out = await collectSources({ titles, ids: [] }, deps(server.fn, cache));
    const wikiCalls = server.urls.filter((u) => u.includes('en.wikipedia.org'));
    expect(wikiCalls.map((u) => new URL(u).searchParams.get('titles')!.split('|').length)).toEqual([20, 20, 5]);
    // "Page 1" to "Page 9" share one length, so their Q-ids repeat; the distinct IDs go in one request.
    const dataCalls = server.urls.filter((u) => u.includes('wikidata.org'));
    expect(dataCalls).toHaveLength(1);
    expect(new URL(dataCalls[0]).searchParams.get('ids')!.split('|')).toEqual(['Q6', 'Q7']);
    expect(out.notFetched).toEqual([]);
    expect(out.requests).toBe(4);
  });

  it('sends 50 Wikidata IDs per request', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);
    const server = wikiServer();
    const out = await collectSources({ titles: [], ids }, deps(server.fn));
    expect(server.urls.map((u) => new URL(u).searchParams.get('ids')!.split('|').length)).toEqual([50, 50, 20]);
    expect(out.results).toHaveLength(120);
  });

  it('waits between requests and runs them one at a time', async () => {
    const titles = Array.from({ length: 41 }, (_, i) => `Page ${i + 1}`);
    const t = fakeTime();
    let inFlight = 0;
    let maxInFlight = 0;
    const server = wikiServer();
    const slow = (async (url: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      const r = await (server.fn as unknown as (u: string) => Promise<unknown>)(url);
      inFlight -= 1;
      return r;
    }) as unknown as typeof fetch;
    await collectSources({ titles, ids: [] }, deps(slow, memoryCache(), t));
    expect(maxInFlight).toBe(1);
    expect(t.waits.length).toBe(server.urls.length - 1);
    expect(t.waits.every((w) => w === 1000)).toBe(true);
  });

  it('saves each source with its URL, revision ID and fetch time', async () => {
    const cache = memoryCache();
    await collectSources({ titles: ['Diwali'], ids: [] }, deps(wikiServer().fn, cache));
    expect(cache.store.get('wikipedia/Diwali')).toMatchObject({ url: 'https://en.wikipedia.org/wiki/Diwali', revisionId: 1006, fetchedAt: FETCHED_AT });
    expect(cache.store.get('wikidata/Q6')).toMatchObject({ url: 'https://www.wikidata.org/wiki/Q6', revisionId: 555, fetchedAt: new Date(1_001_000).toISOString() });
  });

  it('reuses the cache without any request, unless refresh is set', async () => {
    const cache = memoryCache();
    await collectSources({ titles: ['Diwali'], ids: [] }, deps(wikiServer().fn, cache));

    const idle = wikiServer();
    const again = await collectSources({ titles: ['Diwali'], ids: [] }, deps(idle.fn, cache));
    expect(idle.urls).toEqual([]);
    expect(again.requests).toBe(0);
    expect(again.results.map((r) => r.from)).toEqual(['cache', 'cache']);

    const fresh = wikiServer();
    const refreshed = await collectSources({ titles: ['Diwali'], ids: [], refresh: true }, deps(fresh.fn, cache));
    expect(fresh.urls).toHaveLength(2);
    expect(refreshed.results.map((r) => r.from)).toEqual(['network', 'network']);
  });

  it('fetches again when a cache entry is damaged', async () => {
    const cache = memoryCache({ 'wikipedia/Diwali': { oops: true } });
    const server = wikiServer();
    const out = await collectSources({ titles: ['Diwali'], ids: [], wikidata: false }, deps(server.fn, cache));
    expect(server.urls).toHaveLength(1);
    expect(out.results[0].from).toBe('network');
  });

  it('skips Wikidata when asked', async () => {
    const server = wikiServer();
    await collectSources({ titles: ['Diwali'], ids: [], wikidata: false }, deps(server.fn));
    expect(server.urls).toHaveLength(1);
  });

  it('lists a missing page as not fetched and still saves the rest', async () => {
    const server = wikiServer({ missing: ['Ghost Page'] });
    const cache = memoryCache();
    const out = await collectSources({ titles: ['Diwali', 'Ghost Page'], ids: [], wikidata: false }, deps(server.fn, cache));
    expect(out.notFetched).toEqual([{ kind: 'wikipedia', key: 'Ghost Page', reason: 'page does not exist on English Wikipedia' }]);
    expect(cache.store.has('wikipedia/Diwali')).toBe(true);
    expect(cache.store.has('wikipedia/Ghost Page')).toBe(false);
  });

  it('lists every title of a batch that keeps failing, and carries on with the next batch', async () => {
    const titles = Array.from({ length: 22 }, (_, i) => `Page ${i + 1}`);
    const good = wikiServer();
    let call = 0;
    const flaky = (async (url: string) => {
      call += 1;
      if (new URL(url).hostname === 'en.wikipedia.org' && call <= 6) return reply({ status: 503 });
      return (good.fn as unknown as (u: string) => Promise<unknown>)(url);
    }) as unknown as typeof fetch;
    const t = fakeTime();
    const cache = memoryCache();
    const out = await collectSources({ titles, ids: [], wikidata: false }, { ...deps(flaky, cache, t), maxRetries: 5 });
    expect(out.notFetched).toHaveLength(20);
    expect(out.notFetched[0]).toEqual({ kind: 'wikipedia', key: 'Page 1', reason: 'HTTP 503 (gave up after 5 retries)' });
    expect(out.results.map((r) => r.key)).toEqual(['Page 21', 'Page 22']);
    expect(cache.store.size).toBe(2);
    expect(t.waits.filter((w) => w >= 2000)).toEqual([2000, 4000, 8000, 16000, 32000]);
  });

  it('refuses titles the API cannot take, without sending them', async () => {
    const server = wikiServer();
    const out = await collectSources({ titles: ['A|B', 'Diwali'], ids: [], wikidata: false }, deps(server.fn));
    expect(out.notFetched).toHaveLength(1);
    expect(out.notFetched[0].key).toBe('A|B');
    expect(new URL(server.urls[0]).searchParams.get('titles')).toBe('Diwali');
  });

  it('follows a continued reply and merges the pages', async () => {
    const f = scripted([
      { body: { continue: { excontinue: '1', continue: '||' }, query: { pages: [{ pageid: 1, title: 'Diwali', fullurl: 'u' }] } } },
      { body: { query: { pages: [{ pageid: 1, title: 'Diwali', extract: 'Text.', revisions: [{ revid: 3, timestamp: 't' }] }] } } },
    ]);
    const out = await collectSources({ titles: ['Diwali'], ids: [], wikidata: false }, deps(f.fn));
    expect(f.calls[1].url).toContain('excontinue=1');
    expect(out.results[0].entry).toMatchObject({ extract: 'Text.', revisionId: 3, url: 'u' });
  });

  it('reports a whole-batch API error against each title', async () => {
    const f = scripted([{ body: { error: { code: 'badvalue', info: 'bad' } } }]);
    const out = await collectSources({ titles: ['A', 'B'], ids: [], wikidata: false }, deps(f.fn));
    expect(out.notFetched.map((n) => n.reason)).toEqual(['API error badvalue: bad', 'API error badvalue: bad']);
  });
});

describe('parseArgs', () => {
  it('collects titles and flags', () => {
    expect(parseArgs(['Diwali', 'list.txt', '--refresh', '--show', '--no-wikidata', '--delay', '250'])).toMatchObject({
      inputs: ['Diwali', 'list.txt'],
      refresh: true,
      show: true,
      wikidata: false,
      delayMs: 250,
    });
  });

  it('rejects no input, unknown options and a bad delay', () => {
    expect(() => parseArgs([])).toThrow('Give at least one');
    expect(() => parseArgs(['A', '--nope'])).toThrow('Unknown option');
    expect(() => parseArgs(['A', '--delay', 'x'])).toThrow('--delay needs');
    expect(() => parseArgs(['A', '--delay'])).toThrow('--delay needs');
    expect(parseArgs(['--help']).help).toBe(true);
  });
});

describe('formatReport', () => {
  it('lists what was saved and what was not fetched, with reasons', async () => {
    const server = wikiServer({ missing: ['Ghost Page'] });
    const out = await collectSources({ titles: ['Diwali', 'Ghost Page'], ids: [] }, { fetch: server.fn, sleep: async () => {}, now: () => 1_000_000, cache: memoryCache(), delayMs: 0 });
    const text = formatReport(out, { pathOf: (k, key) => `.cache/word-sources/${k}/${key}.json`, show: true });
    expect(text).toContain('2 ready (2 fetched, 0 from cache), 1 not fetched');
    expect(text).toContain('URL: https://en.wikipedia.org/wiki/Diwali');
    expect(text).toContain('revision 1006');
    expect(text).toContain('Text: Diwali intro text.');
    expect(text).toContain('Not fetched:\n- [wikipedia] Ghost Page: page does not exist on English Wikipedia');
  });
});
