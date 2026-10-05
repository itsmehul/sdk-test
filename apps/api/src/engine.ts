import type { ChatCompletionRequest } from "./schemas";

export const MODELS = [
  { id: "interfaze-beta", owned_by: "interfaze", created: 1_759_622_400 },
  { id: "interfaze-embed", owned_by: "interfaze", created: 1_759_622_400 },
] as const;

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "tinyllama";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text:v1.5";

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

export class UpstreamError extends Error {}

type OllamaChatChunk = {
  message?: { content?: string };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

function messageText(content: ChatCompletionRequest["messages"][number]["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

function chatBody(request: ChatCompletionRequest, stream: boolean) {
  const format = request.response_format;
  return {
    model: CHAT_MODEL,
    stream,
    messages: request.messages.map((m) => ({
      role: m.role === "developer" ? "system" : m.role,
      content: messageText(m.content),
    })),
    format:
      format?.type === "json_object"
        ? "json"
        : format?.type === "json_schema"
          ? (format.json_schema.schema ?? "json")
          : undefined,
    options: {
      temperature: request.temperature,
      top_p: request.top_p,
      num_predict: request.max_completion_tokens ?? request.max_tokens,
      stop: typeof request.stop === "string" ? [request.stop] : request.stop,
      seed: request.seed,
    },
  };
}

async function ollama(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new UpstreamError(`Ollama is unreachable at ${OLLAMA_BASE_URL}: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { error?: string } | null;
    throw new UpstreamError(`Ollama error (${res.status}): ${detail?.error ?? res.statusText}`);
  }
  return res;
}

const finishReason = (reason?: string): FinishReason => (reason === "length" ? "length" : "stop");

export async function complete(request: ChatCompletionRequest): Promise<ChatResult> {
  const res = await ollama("/api/chat", chatBody(request, false));
  const data = (await res.json()) as OllamaChatChunk;
  return {
    content: data.message?.content ?? "",
    finishReason: finishReason(data.done_reason),
    promptTokens: data.prompt_eval_count ?? 0,
    completionTokens: data.eval_count ?? 0,
  };
}

export async function* streamComplete(
  request: ChatCompletionRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatDelta> {
  const res = await ollama("/api/chat", chatBody(request, true), signal);
  if (!res.body) throw new UpstreamError("Ollama returned an empty stream");

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of res.body) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as OllamaChatChunk;
      if (chunk.error) throw new UpstreamError(`Ollama error: ${chunk.error}`);
      if (chunk.message?.content) yield { type: "content", content: chunk.message.content };
      if (chunk.done) {
        yield {
          type: "done",
          finishReason: finishReason(chunk.done_reason),
          promptTokens: chunk.prompt_eval_count ?? 0,
          completionTokens: chunk.eval_count ?? 0,
        };
        return;
      }
    }
  }
}

/** nomic-embed-text is Matryoshka-trained, so truncating and renormalising preserves quality. */
function truncate(vector: number[], dimensions?: number): number[] {
  if (!dimensions || dimensions >= vector.length) return vector;
  const sliced = vector.slice(0, dimensions);
  const norm = Math.hypot(...sliced) || 1;
  return sliced.map((v) => v / norm);
}

export async function embed(
  inputs: string[],
  dimensions?: number,
): Promise<{ embeddings: number[][]; promptTokens: number }> {
  const res = await ollama("/api/embed", { model: EMBED_MODEL, input: inputs });
  const data = (await res.json()) as { embeddings: number[][]; prompt_eval_count?: number };
  return {
    embeddings: data.embeddings.map((v) => truncate(v, dimensions)),
    promptTokens: data.prompt_eval_count ?? 0,
  };
}

/** Little-endian float32 bytes as base64, matching OpenAI's `encoding_format: "base64"`. */
export function toBase64(vector: number[]): string {
  const bytes = new Uint8Array(new Float32Array(vector).buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
