import type { ChatCompletionRequest } from "./schemas";

export const MODELS = [
  { id: "rightpeople-beta", owned_by: "rightpeople", created: 1_759_622_400 },
  { id: "rightpeople-embed", owned_by: "rightpeople", created: 1_759_622_400 },
] as const;

export type FinishReason = "stop" | "length";

export type ChatResult = {
  content: string;
  finishReason: FinishReason;
  promptTokens: number;
  completionTokens: number;
};

export type ChatDelta =
  | { type: "content"; content: string }
  | ({ type: "done" } & Omit<ChatResult, "content">);

export type EmbedResult = { embeddings: number[][]; promptTokens: number };

export interface Engine {
  complete(request: ChatCompletionRequest): Promise<ChatResult>;
  stream(request: ChatCompletionRequest, signal?: AbortSignal): AsyncGenerator<ChatDelta>;
  embed(inputs: string[], dimensions?: number): Promise<EmbedResult>;
}

/** Failure talking to the inference backend, surfaced to clients as an OpenAI-style error. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503 = 502,
    readonly code = "upstream_error",
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

function messageText(content: ChatCompletionRequest["messages"][number]["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}

/** nomic-embed-text is Matryoshka-trained, so truncating and renormalising preserves quality. */
function truncate(vector: number[], dimensions?: number): number[] {
  if (!dimensions || dimensions >= vector.length) return vector;
  const sliced = vector.slice(0, dimensions);
  const norm = Math.hypot(...sliced) || 1;
  return sliced.map((v) => v / norm);
}

const finishReason = (reason?: string | null): FinishReason =>
  reason === "length" ? "length" : "stop";

export type OpenAICompatibleConfig = {
  /** Base URL including `/v1`. A function lets callers discover the backend per request. */
  baseURL: string | ((kind: "chat" | "embed") => Promise<string>);
  apiKey?: string | (() => Promise<string | undefined>);
  chatModel: string;
  embedModel: string;
  onUnreachable?: (kind: "chat" | "embed") => void;
};

type UpstreamUsage = { prompt_tokens?: number; completion_tokens?: number };
type UpstreamChoice = {
  message?: { content?: string | null };
  delta?: { content?: string | null };
  finish_reason?: string | null;
};
type UpstreamChat = { choices?: UpstreamChoice[]; usage?: UpstreamUsage | null };

/** Any server speaking the OpenAI API: Ollama (`/v1`) locally, vLLM in production. */
export function openAICompatibleEngine(config: OpenAICompatibleConfig): Engine {
  async function post(kind: "chat" | "embed", path: string, body: unknown, signal?: AbortSignal) {
    const base = typeof config.baseURL === "string" ? config.baseURL : await config.baseURL(kind);
    const apiKey = typeof config.apiKey === "function" ? await config.apiKey() : config.apiKey;
    const url = `${base.replace(/\/$/, "")}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      config.onUnreachable?.(kind);
      throw new UpstreamError(
        `Inference backend unreachable at ${base}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as {
        error?: string | { message?: string };
      } | null;
      const message =
        typeof detail?.error === "string"
          ? detail.error
          : (detail?.error?.message ?? res.statusText);
      throw new UpstreamError(`Inference backend error (${res.status}): ${message}`);
    }
    return res;
  }

  function chatBody(request: ChatCompletionRequest, stream: boolean) {
    return {
      model: config.chatModel,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      messages: request.messages.map((m) => ({
        role: m.role === "developer" ? "system" : m.role,
        content: messageText(m.content),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      })),
      temperature: request.temperature,
      top_p: request.top_p,
      max_tokens: request.max_completion_tokens ?? request.max_tokens,
      stop: request.stop,
      seed: request.seed,
      response_format: request.response_format,
    };
  }

  return {
    async complete(request) {
      const res = await post("chat", "/chat/completions", chatBody(request, false));
      const data = (await res.json()) as UpstreamChat;
      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content ?? "",
        finishReason: finishReason(choice?.finish_reason),
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      };
    },

    async *stream(request, signal) {
      const res = await post("chat", "/chat/completions", chatBody(request, true), signal);
      if (!res.body) throw new UpstreamError("Inference backend returned an empty stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let reason: FinishReason = "stop";
      let usage: UpstreamUsage | null | undefined;

      for await (const bytes of res.body) {
        buffer += decoder.decode(bytes, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            yield {
              type: "done",
              finishReason: reason,
              promptTokens: usage?.prompt_tokens ?? 0,
              completionTokens: usage?.completion_tokens ?? 0,
            };
            return;
          }
          const chunk = JSON.parse(data) as UpstreamChat;
          const choice = chunk.choices?.[0];
          if (choice?.delta?.content) yield { type: "content", content: choice.delta.content };
          if (choice?.finish_reason) reason = finishReason(choice.finish_reason);
          if (chunk.usage) usage = chunk.usage;
        }
      }
      throw new UpstreamError("Inference stream ended before [DONE]");
    },

    async embed(inputs, dimensions) {
      const res = await post("embed", "/embeddings", { model: config.embedModel, input: inputs });
      const data = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
        usage?: { prompt_tokens?: number };
      };
      return {
        embeddings: [...data.data]
          .sort((a, b) => a.index - b.index)
          .map((d) => truncate(d.embedding, dimensions)),
        promptTokens: data.usage?.prompt_tokens ?? 0,
      };
    },
  };
}

const countTokens = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Deterministic stand-in so the API, spec and SDKs can be tested without a model. */
export const echoEngine: Engine = {
  async complete(request) {
    const prompt = request.messages.map((m) => messageText(m.content)).join("\n");
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const content = `Echo: ${messageText(lastUser?.content ?? null)}`;
    return {
      content,
      finishReason: "stop",
      promptTokens: countTokens(prompt),
      completionTokens: countTokens(content),
    };
  },

  async *stream(request) {
    const { content, ...done } = await this.complete(request);
    for (const token of content.match(/\S+\s*/g) ?? []) yield { type: "content", content: token };
    yield { type: "done", ...done };
  },

  async embed(inputs, dimensions = 256) {
    const embeddings = inputs.map((text) => {
      const vector = new Array<number>(dimensions).fill(0);
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const slot = (code * 31 + i * 17) % dimensions;
        vector[slot] = (vector[slot] ?? 0) + ((code % 7) - 3);
      }
      const norm = Math.hypot(...vector) || 1;
      return vector.map((v) => v / norm);
    });
    return { embeddings, promptTokens: inputs.reduce((sum, t) => sum + countTokens(t), 0) };
  },
};

/** `RIGHTPEOPLE_ENGINE=echo` for tests; otherwise an OpenAI-compatible backend (Ollama by default). */
export function engineFromEnv(env: NodeJS.ProcessEnv = process.env): Engine {
  if (env.RIGHTPEOPLE_ENGINE === "echo") return echoEngine;
  return openAICompatibleEngine({
    baseURL: env.INFERENCE_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: env.INFERENCE_API_KEY,
    chatModel: env.CHAT_MODEL ?? "tinyllama",
    embedModel: env.EMBED_MODEL ?? "nomic-embed-text:v1.5",
  });
}

/** Little-endian float32 bytes as base64, matching OpenAI's `encoding_format: "base64"`. */
export function toBase64(vector: number[]): string {
  const bytes = new Uint8Array(new Float32Array(vector).buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
