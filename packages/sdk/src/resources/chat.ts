import type { APIClient, RequestOptions } from "../core/http";
import type { Stream } from "../core/streaming";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "../types";

export class Completions {
  readonly #client: APIClient;

  constructor(client: APIClient) {
    this.#client = client;
  }

  create(
    body: ChatCompletionCreateParamsNonStreaming,
    options?: RequestOptions,
  ): Promise<ChatCompletion>;
  create(
    body: ChatCompletionCreateParamsStreaming,
    options?: RequestOptions,
  ): Promise<Stream<ChatCompletionChunk>>;
  create(
    body: ChatCompletionCreateParams,
    options?: RequestOptions,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>>;
  create(
    body: ChatCompletionCreateParams,
    options?: RequestOptions,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> {
    const spec = { method: "POST", path: "/chat/completions", body, options } as const;
    if (body.stream) {
      return this.#client.stream<ChatCompletionChunk>({
        ...spec,
        options: { ...options, headers: { Accept: "text/event-stream", ...options?.headers } },
      });
    }
    return this.#client.json<ChatCompletion>(spec);
  }
}

export class Chat {
  readonly completions: Completions;

  constructor(client: APIClient) {
    this.completions = new Completions(client);
  }
}
