const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;
const MAX_RETRY_AFTER_MS = 60_000;

export function shouldRetry(response: Response): boolean {
  const override = response.headers.get("x-should-retry");
  if (override === "true") return true;
  if (override === "false") return false;
  return (
    response.status === 408 ||
    response.status === 409 ||
    response.status === 429 ||
    response.status >= 500
  );
}

/** Server-provided delay from `retry-after-ms` or `retry-after` (seconds or HTTP date). */
function retryAfterMs(headers?: Headers): number | null {
  if (!headers) return null;
  const ms = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;

  const value = headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : date - Date.now();
}

/** Exponential backoff with full jitter, unless the server specifies a reasonable delay. */
export function retryDelay(attempt: number, headers?: Headers): number {
  const fromServer = retryAfterMs(headers);
  if (fromServer != null && fromServer >= 0 && fromServer <= MAX_RETRY_AFTER_MS) {
    return fromServer;
  }
  const ceiling = Math.min(MAX_DELAY_MS, INITIAL_DELAY_MS * 2 ** attempt);
  return Math.random() * ceiling;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
