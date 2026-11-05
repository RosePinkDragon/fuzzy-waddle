/**
 * Logic for `npm run words:sources` (#73): fetches Wikipedia intro extracts and
 * Wikidata labels, aliases and sitelinks politely, and caches them.
 *
 * Everything here is free of file and network access of its own. The caller
 * passes in `fetch`, `sleep`, `now` and a cache, so tests run with mocked HTTP
 * and no waiting. scripts/words-sources.js wires in the real ones.
 *
 * It never invents content: a page that can't be fetched or parsed is listed
 * as "not fetched" with the reason, and nothing is filled in for it.
 */

const REPO_URL = 'https://github.com/RosePinkDragon/fuzzy-waddle';
/** Generic tool name plus the repo URL. No email or personal data. */
const USER_AGENT = `fuzzy-waddle-words-sources/1.0 (+${REPO_URL}; word-bank research tool)`;

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/** The MediaWiki Action API allows 20 titles per request for intro extracts. */
const WIKIPEDIA_BATCH = 20;
/** wbgetentities allows 50 IDs per request. */
const WIKIDATA_BATCH = 50;

const DEFAULT_DELAY_MS = 1000;
const DEFAULT_MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
/** A Retry-After longer than this isn't waited out. The batch is reported instead. */
const MAX_RETRY_AFTER_MS = 5 * 60000;
const MAX_CONTINUATIONS = 5;

const WIKIDATA_LANGUAGES = ['en', 'hi'];
const WIKIDATA_SITES = ['enwiki', 'hiwiki'];

const QID = /^Q\d+$/i;

/**
 * @typedef {{ url: string, error?: string }} Item
 * @typedef {{ kind: 'wikipedia' | 'wikidata', key: string, reason: string }} NotFetched
 * @typedef {{ kind: 'wikipedia' | 'wikidata', key: string, from: 'cache' | 'network', entry: any }} Result
 * @typedef {{ read: (kind: string, key: string) => any, write: (kind: string, key: string, entry: any) => string }} Cache
 */

class SourceFetchError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(reason);
    this.name = 'SourceFetchError';
    this.reason = reason;
  }
}

/** Splits a list into chunks of at most `size`. */
function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Tidies a title the way MediaWiki would: underscores to spaces, runs of spaces collapsed. */
function normalizeTitle(title) {
  return String(title).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Turns raw lines (one title per line; blank lines and `#` comments skipped)
 * into Wikipedia titles and Wikidata IDs (`Q123`), without repeats.
 * @param {string[]} lines
 * @returns {{ titles: string[], ids: string[] }}
 */
function parseTitles(lines) {
  const titles = [];
  const ids = [];
  for (const raw of lines) {
    const line = normalizeTitle(raw);
    if (!line || line.startsWith('#')) continue;
    if (QID.test(line)) {
      const id = line.toUpperCase();
      if (!ids.includes(id)) ids.push(id);
    } else if (!titles.includes(line)) {
      titles.push(line);
    }
  }
  return { titles, ids };
}

/** A reason a title can't be sent in a batch, or null when it's fine. */
function titleProblem(title) {
  if (/[|\n\r]/.test(title)) return "title contains '|' or a line break, which the API can't take";
  if (title.length > 255) return 'title is longer than 255 characters';
  return null;
}

// ---- Requests ----

function wikipediaUrl(titles) {
  const p = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    maxlag: '5',
    prop: 'extracts|revisions|pageprops|info',
    exintro: '1',
    explaintext: '1',
    exlimit: 'max',
    rvprop: 'ids|timestamp',
    ppprop: 'wikibase_item',
    inprop: 'url',
    titles: titles.join('|'),
  });
  return `${WIKIPEDIA_API}?${p.toString()}`;
}

function wikidataUrl(ids) {
  const p = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    maxlag: '5',
    ids: ids.join('|'),
    props: 'labels|aliases|sitelinks/urls|info',
    languages: WIKIDATA_LANGUAGES.join('|'),
    sitefilter: WIKIDATA_SITES.join('|'),
  });
  return `${WIKIDATA_API}?${p.toString()}`;
}

// ---- Backoff ----

/**
 * Milliseconds to wait before the next try. Exponential (2s, 4s, 8s, ... up to
 * a minute), and never shorter than the server's Retry-After.
 * @param {number} attempt zero for the first retry
 * @param {number | null} retryAfterMs
 */
function backoffMs(attempt, retryAfterMs = null) {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return retryAfterMs === null ? exp : Math.max(exp, retryAfterMs);
}

/**
 * Reads a Retry-After header: a number of seconds, or an HTTP date.
 * @param {string | null | undefined} value
 * @param {number} nowMs
 * @returns {number | null} milliseconds, or null when absent or unreadable
 */
function parseRetryAfter(value, nowMs) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (/^\d+$/.test(text)) return Number(text) * 1000;
  const when = Date.parse(text);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - nowMs);
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * GETs a URL and parses the JSON. Retries only on 429, 5xx, a maxlag reply or a
 * network error, one try at a time with an exponential wait between tries.
 * Any other failure stops straight away.
 * @param {string} url
 * @param {{ fetch: typeof fetch, sleep: (ms: number) => Promise<void>, now: () => number,
 *   maxRetries?: number, log?: (line: string) => void }} deps
 * @returns {Promise<any>}
 */
async function requestJson(url, deps) {
  const { fetch: doFetch, sleep, now, maxRetries = DEFAULT_MAX_RETRIES, log = () => {} } = deps;
  let reason = 'no attempt made';
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let retryAfterMs = null;
    try {
      const res = await doFetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      retryAfterMs = parseRetryAfter(res.headers && res.headers.get ? res.headers.get('retry-after') : null, now());
      if (isRetryableStatus(res.status)) {
        reason = `HTTP ${res.status}`;
      } else if (!res.ok) {
        throw new SourceFetchError(`HTTP ${res.status}`);
      } else {
        let json;
        try {
          json = await res.json();
        } catch {
          throw new SourceFetchError('reply was not valid JSON');
        }
        if (json && json.error && json.error.code === 'maxlag') {
          reason = 'servers are lagging (maxlag)';
        } else {
          return json;
        }
      }
    } catch (err) {
      if (err instanceof SourceFetchError) throw err;
      reason = `network error: ${err && err.message ? err.message : String(err)}`;
    }
    if (attempt === maxRetries) break;
    if (retryAfterMs !== null && retryAfterMs > MAX_RETRY_AFTER_MS) {
      throw new SourceFetchError(`${reason}; Retry-After of ${Math.round(retryAfterMs / 1000)}s is too long to wait`);
    }
    const wait = backoffMs(attempt, retryAfterMs);
    log(`  ${reason}; waiting ${(wait / 1000).toFixed(1)}s before retry ${attempt + 1} of ${maxRetries}`);
    await sleep(wait);
  }
  throw new SourceFetchError(`${reason} (gave up after ${maxRetries} retries)`);
}

/**
 * A client that sends one request at a time, leaving at least `delayMs`
 * between the end of one and the start of the next.
 * @param {{ fetch: typeof fetch, sleep: (ms: number) => Promise<void>, now: () => number,
 *   delayMs?: number, maxRetries?: number, log?: (line: string) => void }} deps
 */
function createClient(deps) {
  const { delayMs = DEFAULT_DELAY_MS } = deps;
  let lastEnd = null;
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    /** @param {string} url */
    async get(url) {
      if (lastEnd !== null) {
        const wait = lastEnd + delayMs - deps.now();
        if (wait > 0) await deps.sleep(wait);
      }
      requests += 1;
      try {
        return await requestJson(url, deps);
      } finally {
        lastEnd = deps.now();
      }
    },
  };
}

// ---- Parsing ----

function apiErrorReason(json) {
  const e = json && json.error;
  if (!e) return null;
  return `API error ${e.code || 'unknown'}${e.info ? `: ${e.info}` : ''}`;
}

function pagePathUrl(base, title) {
  return `${base}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/**
 * Reads one Action API reply for the titles asked for. Follows normalisation
 * and redirects so each requested title maps to the page it landed on.
 * @param {any} json
 * @param {string[]} requested
 * @param {{ apiUrl: string, fetchedAt: string }} meta
 * @returns {{ entries: any[], notFetched: NotFetched[] }}
 */
function parseWikipedia(json, requested, meta) {
  const error = apiErrorReason(json);
  if (error) throw new SourceFetchError(error);
  const query = (json && json.query) || {};
  const pages = Array.isArray(query.pages) ? query.pages : [];
  const normalized = new Map((query.normalized || []).map((n) => [n.from, n.to]));
  const redirects = new Map((query.redirects || []).map((r) => [r.from, r]));
  const byTitle = new Map(pages.map((p) => [p.title, p]));

  const entries = [];
  const notFetched = [];
  for (const title of requested) {
    let current = normalized.get(title) || title;
    let redirectedFrom = null;
    let fragment = null;
    for (let hops = 0; hops < 5 && redirects.has(current); hops += 1) {
      const r = redirects.get(current);
      redirectedFrom = redirectedFrom || current;
      fragment = r.tofragment || fragment;
      current = r.to;
    }
    const page = byTitle.get(current);
    if (!page) {
      notFetched.push({ kind: 'wikipedia', key: title, reason: 'not in the API reply' });
    } else if (page.missing) {
      notFetched.push({ kind: 'wikipedia', key: title, reason: 'page does not exist on English Wikipedia' });
    } else if (page.invalid) {
      notFetched.push({ kind: 'wikipedia', key: title, reason: `invalid title${page.invalidreason ? `: ${page.invalidreason}` : ''}` });
    } else if (typeof page.extract !== 'string' || page.extract.trim() === '') {
      notFetched.push({ kind: 'wikipedia', key: title, reason: 'page has no intro text' });
    } else {
      const rev = (page.revisions && page.revisions[0]) || {};
      const revisionId = typeof rev.revid === 'number' ? rev.revid : null;
      const pageUrl = page.fullurl || pagePathUrl('https://en.wikipedia.org', page.title);
      entries.push({
        kind: 'wikipedia',
        requestedTitle: title,
        title: page.title,
        pageId: page.pageid,
        url: pageUrl,
        permalink: revisionId === null ? null : `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title.replace(/ /g, '_'))}&oldid=${revisionId}`,
        revisionId,
        revisionTime: rev.timestamp || null,
        fetchedAt: meta.fetchedAt,
        apiUrl: meta.apiUrl,
        redirectedFrom,
        redirectFragment: fragment,
        wikidataId: (page.pageprops && page.pageprops.wikibase_item) || null,
        extract: page.extract,
      });
    }
  }
  return { entries, notFetched };
}

/**
 * Reads one wbgetentities reply: labels and aliases (English and Hindi) and the
 * English and Hindi Wikipedia sitelinks.
 * @param {any} json
 * @param {string[]} requested
 * @param {{ apiUrl: string, fetchedAt: string }} meta
 * @returns {{ entries: any[], notFetched: NotFetched[] }}
 */
function parseWikidata(json, requested, meta) {
  const error = apiErrorReason(json);
  if (error) throw new SourceFetchError(error);
  const entities = (json && json.entities) || {};
  const all = Object.values(entities);
  const entries = [];
  const notFetched = [];
  for (const id of requested) {
    // A redirected ID comes back under the ID it points to.
    const entity = entities[id] || all.find((e) => e && e.id === id);
    if (!entity) {
      notFetched.push({ kind: 'wikidata', key: id, reason: 'not in the API reply' });
    } else if (entity.missing !== undefined) {
      notFetched.push({ kind: 'wikidata', key: id, reason: 'entity does not exist on Wikidata' });
    } else {
      const label = (lang) => (entity.labels && entity.labels[lang] ? entity.labels[lang].value : null);
      const aliases = (lang) => ((entity.aliases && entity.aliases[lang]) || []).map((a) => a.value);
      const sitelinks = {};
      for (const site of WIKIDATA_SITES) {
        const link = entity.sitelinks && entity.sitelinks[site];
        if (link) sitelinks[site] = { title: link.title, url: link.url || null };
      }
      entries.push({
        kind: 'wikidata',
        id,
        resolvedId: entity.id,
        url: `https://www.wikidata.org/wiki/${entity.id}`,
        revisionId: typeof entity.lastrevid === 'number' ? entity.lastrevid : null,
        revisionTime: entity.modified || null,
        fetchedAt: meta.fetchedAt,
        apiUrl: meta.apiUrl,
        labels: { en: label('en'), hi: label('hi') },
        aliases: { en: aliases('en'), hi: aliases('hi') },
        sitelinks,
      });
    }
  }
  return { entries, notFetched };
}

// ---- Cache file names ----

/**
 * A safe file name for a cache key. Titles keep their letters (encoded where
 * needed) so the folder stays readable; very long ones get a hash on the end.
 * @param {string} key
 * @param {(text: string) => string} hash
 */
function cacheFileName(key, hash) {
  const safe = encodeURIComponent(key.replace(/ /g, '_')).replace(/\*/g, '%2A').replace(/^\./, '%2E');
  if (safe.length <= 120) return `${safe}.json`;
  return `${safe.slice(0, 100)}-${hash(key)}.json`;
}

/** True for a cache entry that has the fields a later run relies on. */
function isUsableCacheEntry(entry) {
  return Boolean(entry && typeof entry === 'object' && entry.url && entry.fetchedAt && (entry.kind === 'wikipedia' || entry.kind === 'wikidata'));
}

// ---- The run ----

/**
 * Fetches what isn't cached (or everything, with `refresh`), saves each source
 * to the cache, and reports what couldn't be fetched. A failed batch is listed
 * and the run carries on with the rest.
 *
 * @param {{ titles: string[], ids: string[], refresh?: boolean, wikidata?: boolean }} request
 * @param {{ fetch: typeof fetch, sleep: (ms: number) => Promise<void>, now: () => number, cache: Cache,
 *   delayMs?: number, maxRetries?: number, log?: (line: string) => void }} deps
 * @returns {Promise<{ results: Result[], notFetched: NotFetched[], requests: number }>}
 */
async function collectSources(request, deps) {
  const { refresh = false, wikidata = true } = request;
  const { cache, now, log = () => {} } = deps;
  const client = createClient(deps);
  /** @type {Result[]} */
  const results = [];
  /** @type {NotFetched[]} */
  const notFetched = [];

  const takeFromCache = (kind, key) => {
    if (refresh) return false;
    const hit = cache.read(kind, key);
    if (!isUsableCacheEntry(hit)) return false;
    results.push({ kind, key, from: 'cache', entry: hit });
    return true;
  };

  const runBatches = async (kind, keys, size, buildUrl, parse) => {
    for (const batch of chunk(keys, size)) {
      const url = buildUrl(batch);
      log(`Fetching ${batch.length} ${kind} ${batch.length === 1 ? 'item' : 'items'}...`);
      try {
        const merged = { json: null };
        let next = url;
        for (let i = 0; i <= MAX_CONTINUATIONS && next; i += 1) {
          const part = await client.get(next);
          merged.json = i === 0 ? part : mergeContinuation(merged.json, part);
          next = part && part.continue && kind === 'wikipedia' && i < MAX_CONTINUATIONS ? `${url}&${new URLSearchParams(part.continue).toString()}` : null;
        }
        const parsed = parse(merged.json, batch, { apiUrl: url, fetchedAt: new Date(now()).toISOString() });
        for (const entry of parsed.entries) {
          const key = entry.kind === 'wikipedia' ? entry.requestedTitle : entry.id;
          cache.write(kind, key, entry);
          results.push({ kind, key, from: 'network', entry });
        }
        notFetched.push(...parsed.notFetched);
      } catch (err) {
        const reason = err instanceof SourceFetchError ? err.reason : `unexpected error: ${err && err.message ? err.message : String(err)}`;
        for (const key of batch) notFetched.push({ kind, key, reason });
      }
    }
  };

  const wikiTitles = [];
  for (const title of request.titles) {
    const problem = titleProblem(title);
    if (problem) notFetched.push({ kind: 'wikipedia', key: title, reason: problem });
    else if (!takeFromCache('wikipedia', title)) wikiTitles.push(title);
  }
  await runBatches('wikipedia', wikiTitles, WIKIPEDIA_BATCH, wikipediaUrl, parseWikipedia);

  if (wikidata) {
    // Explicit IDs, plus the item behind each page we have.
    const wanted = [...request.ids];
    for (const r of results) {
      const id = r.kind === 'wikipedia' ? r.entry.wikidataId : null;
      if (id && !wanted.includes(id)) wanted.push(id);
    }
    const wikidataIds = wanted.filter((id) => !takeFromCache('wikidata', id));
    await runBatches('wikidata', wikidataIds, WIKIDATA_BATCH, wikidataUrl, parseWikidata);
  }

  return { results, notFetched, requests: client.requests };
}

/** Joins a continued Action API reply onto the first, merging pages by ID. */
function mergeContinuation(first, more) {
  const pages = new Map(((first.query && first.query.pages) || []).map((p) => [p.pageid !== undefined ? p.pageid : p.title, p]));
  for (const p of (more.query && more.query.pages) || []) {
    const k = p.pageid !== undefined ? p.pageid : p.title;
    pages.set(k, { ...(pages.get(k) || {}), ...p });
  }
  return { ...first, query: { ...(first.query || {}), pages: [...pages.values()] }, continue: more.continue };
}

// ---- Command line ----

const USAGE = [
  'Usage: npm run words:sources -- <title | Q-id | file> [...] [--refresh] [--no-wikidata] [--show] [--delay <ms>]',
  '  A title is an English Wikipedia page (Diwali, "Dilwale Dulhania Le Jayenge"). A Q-id (Q10434) goes to Wikidata.',
  '  A file holds one title or Q-id per line (blank lines and lines starting with # are skipped).',
  '  --refresh       fetch again even when the source is cached',
  '  --no-wikidata   skip the Wikidata lookups (labels, Hindi aliases, sitelinks)',
  '  --show          print each source\'s text and aliases, not just where it was saved',
  `  --delay <ms>    pause between requests (default ${DEFAULT_DELAY_MS})`,
].join('\n');

/**
 * @param {string[]} argv
 * @returns {{ inputs: string[], refresh: boolean, wikidata: boolean, show: boolean, delayMs: number, help: boolean }}
 */
function parseArgs(argv) {
  const opts = { inputs: [], refresh: false, wikidata: true, show: false, delayMs: DEFAULT_DELAY_MS, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--refresh') opts.refresh = true;
    else if (a === '--no-wikidata') opts.wikidata = false;
    else if (a === '--show') opts.show = true;
    else if (a === '--delay') {
      i += 1;
      const n = Number(argv[i]);
      if (argv[i] === undefined || argv[i] === '' || !Number.isInteger(n) || n < 0) throw new Error(`--delay needs a whole number of milliseconds\n${USAGE}`);
      opts.delayMs = n;
    } else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}\n${USAGE}`);
    else opts.inputs.push(a);
  }
  if (!opts.help && opts.inputs.length === 0) throw new Error(`Give at least one title, Q-id or file.\n${USAGE}`);
  return opts;
}

/**
 * The text the command prints when it finishes.
 * @param {{ results: Result[], notFetched: NotFetched[], requests: number }} outcome
 * @param {{ pathOf: (kind: string, key: string) => string, show?: boolean }} options
 */
function formatReport(outcome, options) {
  const lines = [];
  const { results, notFetched } = outcome;
  const fromNetwork = results.filter((r) => r.from === 'network').length;
  lines.push(`Sources: ${results.length} ready (${fromNetwork} fetched, ${results.length - fromNetwork} from cache), ${notFetched.length} not fetched, ${outcome.requests} request${outcome.requests === 1 ? '' : 's'} sent.`);
  for (const r of results) {
    const e = r.entry;
    const rev = e.revisionId === null || e.revisionId === undefined ? 'no revision ID' : `revision ${e.revisionId}`;
    const name = r.kind === 'wikipedia' ? `${e.title}${e.redirectedFrom ? ` (redirect from ${e.redirectedFrom})` : ''}` : `${e.id}${e.labels && e.labels.en ? ` ${e.labels.en}` : ''}`;
    lines.push('');
    lines.push(`- [${r.kind}] ${name} - ${r.from === 'cache' ? 'cached' : 'fetched'}, ${rev}, fetched ${e.fetchedAt}`);
    lines.push(`  URL: ${e.url}`);
    lines.push(`  File: ${options.pathOf(r.kind, r.key)}`);
    if (options.show) {
      if (r.kind === 'wikipedia') lines.push(`  Text: ${e.extract}`);
      else {
        lines.push(`  Labels: en ${e.labels.en || '(none)'}; hi ${e.labels.hi || '(none)'}`);
        lines.push(`  Aliases: en ${e.aliases.en.join(', ') || '(none)'}; hi ${e.aliases.hi.join(', ') || '(none)'}`);
        lines.push(`  Sitelinks: ${Object.entries(e.sitelinks).map(([s, l]) => `${s} ${l.title}`).join('; ') || '(none)'}`);
      }
    }
  }
  if (notFetched.length > 0) {
    lines.push('');
    lines.push('Not fetched:');
    for (const n of notFetched) lines.push(`- [${n.kind}] ${n.key}: ${n.reason}`);
  }
  return lines.join('\n');
}

module.exports = {
  USER_AGENT,
  WIKIPEDIA_BATCH,
  WIKIDATA_BATCH,
  DEFAULT_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  MAX_RETRY_AFTER_MS,
  SourceFetchError,
  chunk,
  normalizeTitle,
  parseTitles,
  wikipediaUrl,
  wikidataUrl,
  backoffMs,
  parseRetryAfter,
  requestJson,
  createClient,
  parseWikipedia,
  parseWikidata,
  cacheFileName,
  isUsableCacheEntry,
  collectSources,
  parseArgs,
  formatReport,
  USAGE,
};
