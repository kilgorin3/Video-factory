import { sleep } from "../util/fsx";

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
  ) {
    super(`[${provider}] ${message}`);
  }
}

export function requireEnv(name: string, provider: string): string {
  const v = process.env[name];
  if (!v) {
    throw new ProviderError(
      provider,
      `${name} is not set. Add it to .env, or run with --mock to build without paid APIs.`,
    );
  }
  return v;
}

/**
 * fetch with retries on 429/5xx/network errors and exponential backoff.
 * Throws ProviderError with the response body on non-retryable failures.
 */
export async function fetchRetry(
  provider: string,
  url: string,
  init: RequestInit & { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const retries = init.retries ?? 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 180_000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if (res.ok) return res;
      const body = await res.text().catch(() => "");
      if (res.status === 429 || res.status >= 500) {
        lastErr = new ProviderError(provider, `HTTP ${res.status}: ${body.slice(0, 500)}`, res.status);
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1500);
        continue;
      }
      throw new ProviderError(provider, `HTTP ${res.status}: ${body.slice(0, 800)}`, res.status);
    } catch (e) {
      if (e instanceof ProviderError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(2 ** attempt * 1500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new ProviderError(provider, String(lastErr));
}

export async function download(provider: string, url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const b64 = url.slice(url.indexOf(",") + 1);
    return Buffer.from(b64, "base64");
  }
  const res = await fetchRetry(provider, url, { timeoutMs: 600_000 });
  return Buffer.from(await res.arrayBuffer());
}
