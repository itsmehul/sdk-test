import { describe, expect, it, vi } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  BadRequestError,
  Interfaze,
  InterfazeError,
  RateLimitError,
} from "../src";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const models = { object: "list", data: [] };

const hang = (request: Request) =>
  new Promise<Response>((_, reject) => {
    if (request.signal.aborted) return reject(request.signal.reason);
    request.signal.addEventListener("abort", () => reject(request.signal.reason));
  });

function setup(responses: Array<Response | Error>, options: Partial<{ maxRetries: number }> = {}) {
  const requests: Request[] = [];
  const fetch = vi.fn(async (request: Request) => {
    requests.push(request);
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  const client = new Interfaze({
    apiKey: "k",
    baseURL: "http://test/v1",
    fetch,
    ...options,
  });
  return { client, fetch, requests };
}

describe("http core", () => {
  it("requires an API key", () => {
    vi.stubEnv("INTERFAZE_API_KEY", "");
    expect(() => new Interfaze({ apiKey: undefined })).toThrow(InterfazeError);
    vi.unstubAllEnvs();
  });

  it("sends auth and sdk headers", async () => {
    const { client, requests } = setup([json(models)]);
    await client.models.list();
    const headers = requests[0]?.headers;
    expect(headers?.get("authorization")).toBe("Bearer k");
    expect(headers?.get("x-interfaze-sdk")).toMatch(/^typescript\//);
  });

  it("retries 5xx with the same idempotency key", async () => {
    const { client, requests } = setup([
      json({}, 503, { "retry-after-ms": "1" }),
      json({}, 500, { "retry-after-ms": "1" }),
      json({ object: "list", data: [] }),
    ]);
    await client.embeddings.create({ model: "m", input: "x" });
    expect(requests).toHaveLength(3);
    const keys = new Set(requests.map((r) => r.headers.get("idempotency-key")));
    expect(keys.size).toBe(1);
    expect(requests.map((r) => r.headers.get("x-interfaze-retry-count"))).toEqual(["0", "1", "2"]);
  });

  it("gives up after maxRetries and throws a typed error", async () => {
    const { client, requests } = setup(
      [json({ error: { message: "slow down" } }, 429, { "retry-after": "0" }), json({}, 429)],
      { maxRetries: 1 },
    );
    const error = await client.models.list().catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(requests).toHaveLength(2);
  });

  it("does not retry 4xx", async () => {
    const { client, requests } = setup([json({ error: { message: "bad" } }, 400)]);
    await expect(client.models.list()).rejects.toBeInstanceOf(BadRequestError);
    expect(requests).toHaveLength(1);
  });

  it("honors x-should-retry: false", async () => {
    const { client, requests } = setup([json({}, 500, { "x-should-retry": "false" })]);
    await expect(client.models.list()).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it("wraps network failures", async () => {
    const { client } = setup([new TypeError("fetch failed")], { maxRetries: 0 });
    await expect(client.models.list()).rejects.toBeInstanceOf(APIConnectionError);
  });

  it("times out per attempt", async () => {
    const client = new Interfaze({
      apiKey: "k",
      baseURL: "http://test/v1",
      maxRetries: 0,
      timeout: 10,
      fetch: hang,
    });
    await expect(client.models.list()).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });

  it("supports caller cancellation before and during a request", async () => {
    const client = new Interfaze({ apiKey: "k", baseURL: "http://test/v1", fetch: hang });

    const early = new AbortController();
    early.abort();
    await expect(client.models.list({ signal: early.signal })).rejects.toBeInstanceOf(
      APIUserAbortError,
    );

    const late = new AbortController();
    const pending = client.models.list({ signal: late.signal });
    setTimeout(() => late.abort(), 5);
    await expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
  });

  it("runs hooks", async () => {
    const seen: number[] = [];
    const client = new Interfaze({
      apiKey: "k",
      baseURL: "http://test/v1",
      fetch: async (request) => json({ ...models, auth: request.headers.get("authorization") }),
      hooks: {
        beforeRequest: (request) => {
          const next = new Request(request);
          next.headers.set("authorization", "Bearer rotated");
          return next;
        },
        afterResponse: (response) => {
          seen.push(response.status);
          return undefined;
        },
      },
    });
    const result = (await client.models.list()) as unknown as { auth: string };
    expect(result.auth).toBe("Bearer rotated");
    expect(seen).toEqual([200]);
  });
});
