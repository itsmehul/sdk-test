import type { ChatCompletionRequest } from "./schemas";

export const MODELS = [
  { id: "interfaze-beta", owned_by: "interfaze", created: 1_759_622_400 },
  { id: "interfaze-embed", owned_by: "interfaze", created: 1_759_622_400 },
] as const;

export type ChatResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
};

const countTokens = (text: string) => text.split(/\s+/).filter(Boolean).length;

function messageText(content: ChatCompletionRequest["messages"][number]["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.text : "[image]")).join(" ");
}

/**
 * Deterministic stand-in for a real model so the API, spec and SDKs can be
 * developed and tested end to end without inference infrastructure.
 */
export function complete(request: ChatCompletionRequest): ChatResult {
  const prompt = request.messages.map((m) => messageText(m.content)).join("\n");
  const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
  const content = `Echo: ${messageText(lastUser?.content ?? null)}`;
  return {
    content,
    promptTokens: countTokens(prompt),
    completionTokens: countTokens(content),
  };
}

export function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

export function embed(text: string, dimensions = 256): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const slot = (code * 31 + i * 17) % dimensions;
    vector[slot] = (vector[slot] ?? 0) + ((code % 7) - 3);
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((v) => v / norm);
}

/** Little-endian float32 bytes as base64, matching OpenAI's `encoding_format: "base64"`. */
export function toBase64(vector: number[]): string {
  const bytes = new Uint8Array(new Float32Array(vector).buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export { countTokens };
