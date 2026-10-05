import { APIError } from "./errors";

export type ServerSentEvent = { event: string | null; data: string; id: string | null };

/** SSE parser over a web `ReadableStream`. Works in Node, Bun, Deno, browsers and edge runtimes. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event: string | null = null;
  let id: string | null = null;
  let data: string[] = [];

  const flush = (): ServerSentEvent | null => {
    const out = data.length > 0 ? { event, id, data: data.join("\n") } : null;
    event = null;
    data = [];
    return out;
  };

  const readField = (line: string) => {
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? "" : line.slice(colon + 1);
    const value = raw.startsWith(" ") ? raw.slice(1) : raw;
    if (field === "data") data.push(value);
    else if (field === "event") event = value;
    else if (field === "id") id = value;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.search(/\r\n|\r|\n/);
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        const width = buffer[newline] === "\r" && buffer[newline + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(newline + width);

        if (line === "") {
          const sse = flush();
          if (sse) yield sse;
        } else {
          readField(line);
        }
        newline = buffer.search(/\r\n|\r|\n/);
      }
    }

    buffer += decoder.decode();
    if (buffer) readField(buffer);
    const sse = flush();
    if (sse) yield sse;
  } finally {
    reader.releaseLock();
  }
}

export class Stream<T> implements AsyncIterable<T> {
  readonly response: Response;
  readonly controller: AbortController;
  private consumed = false;

  constructor(response: Response, controller: AbortController) {
    this.response = response;
    this.controller = controller;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.consumed) throw new Error("Stream can only be iterated once");
    this.consumed = true;
    if (!this.response.body) throw new Error("Response has no body");

    let finished = false;
    try {
      for await (const sse of parseSSE(this.response.body)) {
        if (sse.data === "[DONE]") {
          finished = true;
          return;
        }
        const parsed = JSON.parse(sse.data);
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          throw new APIError(this.response.status, parsed, this.response.headers);
        }
        yield parsed as T;
      }
      finished = true;
    } finally {
      if (!finished) this.controller.abort();
    }
  }

  /** Stop receiving events and close the underlying connection. */
  abort(): void {
    this.controller.abort();
  }

  /** Expose the stream as a web `ReadableStream`, e.g. to return from a route handler. */
  toReadableStream(): ReadableStream<T> {
    const iterator = this[Symbol.asyncIterator]();
    return new ReadableStream<T>({
      async pull(ctrl) {
        const { value, done } = await iterator.next();
        if (done) ctrl.close();
        else ctrl.enqueue(value);
      },
      cancel: async () => {
        await iterator.return?.();
      },
    });
  }
}
