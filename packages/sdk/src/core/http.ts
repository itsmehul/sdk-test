import { VERSION } from "../version";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  RightPeopleError,
} from "./errors";
import { retryDelay, shouldRetry, sleep } from "./retry";
import { Stream } from "./streaming";

export const DEFAULT_BASE_URL = "https://api.rightpeople.ai/v1";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;

type Fetch = (input: Request) => Response | Promise<Response>;

export interface Hooks {
  /** Runs before every attempt. Return a new `Request` to replace it (e.g. inject a rotating token). */
  beforeRequest?: (request: Request) => Request | undefined | Promise<Request | undefined>;
  /** Runs after every attempt, including ones that will be retried. */
  afterResponse?: (
    response: Response,
    request: Request,
  ) => Response | undefined | Promise<Response | undefined>;
}

export interface ClientOptions {
  /** Defaults to `process.env.RIGHTPEOPLE_API_KEY`. */
  apiKey?: string;
  /** Defaults to `process.env.RIGHTPEOPLE_BASE_URL`, then `https://api.rightpeople.ai/v1`. */
  baseURL?: string;
  /** Milliseconds to wait for response headers per attempt. Default 60s. */
  timeout?: number;
  /** Retries for connection errors, timeouts, 408, 409, 429 and 5xx. Default 2. */
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
  /** Custom fetch implementation, e.g. for proxies or tests. */
  fetch?: Fetch;
  hooks?: Hooks;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  /** Sent as `Idempotency-Key`. Generated automatically for POST requests and reused across retries. */
  idempotencyKey?: string;
}

type RequestSpec = {
  method: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  options?: RequestOptions;
};

const env = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];

export class APIClient {
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;
  #apiKey: string;
  #defaultHeaders: Record<string, string>;
  #fetch: Fetch;
  #hooks: Hooks;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? env("RIGHTPEOPLE_API_KEY");
    if (!apiKey) {
      throw new RightPeopleError(
        "Missing API key. Pass `apiKey` or set the RIGHTPEOPLE_API_KEY environment variable.",
      );
    }
    this.#apiKey = apiKey;
    this.baseURL = (options.baseURL ?? env("RIGHTPEOPLE_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#defaultHeaders = options.defaultHeaders ?? {};
    this.#fetch = options.fetch ?? ((request) => fetch(request));
    this.#hooks = options.hooks ?? {};
  }

  async json<T>(spec: RequestSpec): Promise<T> {
    const response = await this.#send(spec);
    return (await response.json()) as T;
  }

  async stream<T>(spec: RequestSpec): Promise<Stream<T>> {
    const controller = new AbortController();
    const signal = spec.options?.signal
      ? AbortSignal.any([spec.options.signal, controller.signal])
      : controller.signal;
    const response = await this.#send({ ...spec, options: { ...spec.options, signal } });
    return new Stream<T>(response, controller);
  }

  #buildURL(path: string, query?: RequestSpec["query"]): string {
    const url = new URL(`${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  #headers(spec: RequestSpec, attempt: number, idempotencyKey?: string): Headers {
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${this.#apiKey}`,
      "X-RightPeople-SDK": `typescript/${VERSION}`,
      "X-RightPeople-Retry-Count": String(attempt),
      ...this.#defaultHeaders,
      ...spec.options?.headers,
    });
    if (spec.body !== undefined) headers.set("Content-Type", "application/json");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    return headers;
  }

  async #send(spec: RequestSpec): Promise<Response> {
    const options = spec.options ?? {};
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeout = options.timeout ?? this.timeout;
    const idempotencyKey =
      options.idempotencyKey ??
      (spec.method === "POST" ? `ifz-retry-${crypto.randomUUID()}` : undefined);
    const url = this.#buildURL(spec.path, spec.query);
    const body = spec.body === undefined ? undefined : JSON.stringify(spec.body);

    for (let attempt = 0; ; attempt++) {
      if (options.signal?.aborted) throw new APIUserAbortError();
      const retriesLeft = attempt < maxRetries;
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), timeout);
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeoutController.signal])
        : timeoutController.signal;

      let request = new Request(url, {
        method: spec.method,
        headers: this.#headers(spec, attempt, idempotencyKey),
        body,
        signal,
      });
      request = (await this.#hooks.beforeRequest?.(request)) ?? request;

      let response: Response;
      try {
        response = await this.#fetch(request);
      } catch (error) {
        clearTimeout(timer);
        if (options.signal?.aborted) throw new APIUserAbortError();
        if (retriesLeft) {
          await this.#wait(attempt, undefined, options.signal);
          continue;
        }
        if (timeoutController.signal.aborted) throw new APIConnectionTimeoutError();
        throw new APIConnectionError(undefined, { cause: error });
      }
      clearTimeout(timer);

      response = (await this.#hooks.afterResponse?.(response, request)) ?? response;
      if (response.ok) return response;

      if (retriesLeft && shouldRetry(response)) {
        await response.body?.cancel().catch(() => {});
        await this.#wait(attempt, response.headers, options.signal);
        continue;
      }
      throw await APIError.fromResponse(response);
    }
  }

  async #wait(attempt: number, headers: Headers | undefined, signal?: AbortSignal): Promise<void> {
    try {
      await sleep(retryDelay(attempt, headers), signal);
    } catch {
      throw new APIUserAbortError();
    }
  }
}
