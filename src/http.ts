const USER_AGENT = "trendmcp/1.0 (+https://github.com/jihoo12/trendmcp)";
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 5 * 60_000;

const cache = new Map<string, { at: number; body: string }>();

/**
 * GET a URL as text with a timeout, a small in-memory cache, and retries on
 * 429/5xx (arXiv in particular rate-limits aggressively).
 */
export async function fetchText(
  url: string,
  opts: { retries?: number; baseDelayMs?: number; throttle?: () => Promise<void> } = {},
): Promise<string> {
  const { retries = 3, baseDelayMs = 1000, throttle } = opts;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttle?.();
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const body = await res.text();
        cache.set(url, { at: Date.now(), body });
        return body;
      }
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : baseDelayMs * 2 ** attempt);
    } catch (err) {
      lastError = err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/** Run `fn` over `items` with at most `limit` in flight at once, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Returns a function that, when awaited before each request, keeps requests at least `gapMs` apart. */
export function spacing(gapMs: number): () => Promise<void> {
  let nextAt = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, nextAt - now);
    nextAt = Math.max(now, nextAt) + gapMs;
    if (wait) await sleep(wait);
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
