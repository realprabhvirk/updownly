/**
 * Small download helper for the data refresh scripts. Only used when a
 * developer explicitly runs `npm run data:fetch` — never by the app.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export const USER_AGENT =
  'UPDOWNLY-data-pipeline/1.0 (https://github.com/realprabhvirk/updownly; build-time dataset refresh)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export type FetchOptions = {
  headers?: Record<string, string>;
  retries?: number;
  /** Treat responses whose body matches this as retryable failures. */
  rejectBody?: RegExp;
  timeoutMs?: number;
};

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Buffer> {
  const retries = opts.retries ?? 6;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, ...opts.headers },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (opts.rejectBody && opts.rejectBody.test(buf.subarray(0, 4000).toString('utf8'))) {
        throw new Error('Rejected response body');
      }
      return buf;
    } catch (err) {
      lastError = err;
      if ((err as { fatal?: boolean }).fatal) throw err;
      const wait = Math.min(60_000, 4_000 * 2 ** attempt);
      console.warn(`  ! ${String((err as Error).message)} — retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw lastError;
}

/** Download `url` to `path` unless it already exists (pass force to refresh). */
export async function download(
  url: string,
  path: string,
  { force = false, ...opts }: FetchOptions & { force?: boolean } = {},
): Promise<void> {
  if (!force && (await exists(path))) {
    console.log(`  = ${path} (cached)`);
    return;
  }
  console.log(`  ↓ ${url.length > 120 ? url.slice(0, 117) + '…' : url}`);
  const buf = await fetchWithRetry(url, opts);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}

export { sleep };
