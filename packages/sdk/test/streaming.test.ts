import { describe, expect, it } from "vitest";
import { APIError, parseSSE, Stream } from "../src";

function bodyFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe("parseSSE", () => {
  it("handles events split across chunks, CRLF, comments and multi-line data", async () => {
    const events = await collect(
      parseSSE(
        bodyFrom([": ping\r\n", "event: a\r\nda", "ta: one\r\ndata: two\r\n\r\n", "data: x"]),
      ),
    );
    expect(events).toEqual([
      { event: "a", id: null, data: "one\ntwo" },
      { event: null, id: null, data: "x" },
    ]);
  });
});

describe("Stream", () => {
  it("stops at [DONE]", async () => {
    const response = new Response(bodyFrom(['data: {"n":1}\n\n', "data: [DONE]\n\n"]));
    const items = await collect(new Stream<{ n: number }>(response, new AbortController()));
    expect(items).toEqual([{ n: 1 }]);
  });

  it("raises error events as APIError", async () => {
    const response = new Response(bodyFrom(['data: {"error":{"message":"boom"}}\n\n']));
    await expect(collect(new Stream(response, new AbortController()))).rejects.toBeInstanceOf(
      APIError,
    );
  });

  it("converts to a ReadableStream", async () => {
    const response = new Response(bodyFrom(['data: {"n":1}\n\n', 'data: {"n":2}\n\n']));
    const readable = new Stream<{ n: number }>(response, new AbortController()).toReadableStream();
    expect(await collect(readable)).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
