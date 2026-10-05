import type { components } from "./generated/schema";

type Schemas = components["schemas"];

export type Model = Schemas["Model"];
export type ModelList = Schemas["ModelList"];

export type ChatCompletionMessageParam = Schemas["ChatCompletionMessage"];
export type ChatCompletionTool = Schemas["ChatCompletionTool"];
export type ChatCompletionMessageToolCall = Schemas["ChatCompletionMessageToolCall"];
export type ChatCompletionCreateParams = Schemas["ChatCompletionRequest"];
export type ChatCompletionCreateParamsStreaming = ChatCompletionCreateParams & { stream: true };
export type ChatCompletionCreateParamsNonStreaming = ChatCompletionCreateParams & {
  stream?: false;
};
export type ChatCompletion = Schemas["ChatCompletion"];
export type ChatCompletionChunk = Schemas["ChatCompletionChunk"];
export type CompletionUsage = Schemas["CompletionUsage"];

export type EmbeddingCreateParams = Schemas["EmbeddingRequest"];
export type CreateEmbeddingResponse = Schemas["EmbeddingResponse"];

export type ErrorResponse = Schemas["ErrorResponse"];

export type { components, operations, paths } from "./generated/schema";
