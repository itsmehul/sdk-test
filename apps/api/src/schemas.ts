import { z } from "@hono/zod-openapi";

export const ErrorResponse = z
  .object({
    error: z.object({
      message: z.string(),
      type: z.string().openapi({ example: "invalid_request_error" }),
      param: z.string().nullable(),
      code: z.string().nullable(),
    }),
  })
  .openapi("ErrorResponse");

export const Model = z
  .object({
    id: z.string().openapi({ example: "rightpeople-beta" }),
    object: z.literal("model"),
    created: z.number().int(),
    owned_by: z.string(),
  })
  .openapi("Model");

export const ModelList = z
  .object({
    object: z.literal("list"),
    data: z.array(Model),
  })
  .openapi("ModelList");

const Role = z.enum(["system", "developer", "user", "assistant", "tool"]);

const TextPart = z
  .object({ type: z.literal("text"), text: z.string() })
  .openapi("ChatCompletionContentPartText");

const ImagePart = z
  .object({
    type: z.literal("image_url"),
    image_url: z.object({
      url: z.string(),
      detail: z.enum(["auto", "low", "high"]).optional(),
    }),
  })
  .openapi("ChatCompletionContentPartImage");

export const ToolCall = z
  .object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({ name: z.string(), arguments: z.string() }),
  })
  .openapi("ChatCompletionMessageToolCall");

export const ChatMessage = z
  .object({
    role: Role,
    content: z
      .union([z.string(), z.array(z.discriminatedUnion("type", [TextPart, ImagePart]))])
      .nullable(),
    name: z.string().optional(),
    tool_calls: z.array(ToolCall).optional(),
    tool_call_id: z.string().optional(),
  })
  .openapi("ChatCompletionMessage");

export const Tool = z
  .object({
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      description: z.string().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      strict: z.boolean().optional(),
    }),
  })
  .openapi("ChatCompletionTool");

export const ChatCompletionRequest = z
  .object({
    model: z.string().openapi({ example: "rightpeople-beta" }),
    messages: z.array(ChatMessage).min(1),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    max_tokens: z.number().int().positive().optional(),
    max_completion_tokens: z.number().int().positive().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    seed: z.number().int().optional(),
    tools: z.array(Tool).optional(),
    tool_choice: z
      .union([
        z.enum(["none", "auto", "required"]),
        z.object({ type: z.literal("function"), function: z.object({ name: z.string() }) }),
      ])
      .optional(),
    response_format: z
      .union([
        z.object({ type: z.literal("text") }),
        z.object({ type: z.literal("json_object") }),
        z.object({
          type: z.literal("json_schema"),
          json_schema: z.object({
            name: z.string(),
            schema: z.record(z.string(), z.unknown()).optional(),
            strict: z.boolean().optional(),
          }),
        }),
      ])
      .optional(),
    stream: z.boolean().optional(),
    stream_options: z.object({ include_usage: z.boolean().optional() }).optional(),
    user: z.string().optional(),
  })
  .openapi("ChatCompletionRequest");

export const Usage = z
  .object({
    prompt_tokens: z.number().int(),
    completion_tokens: z.number().int(),
    total_tokens: z.number().int(),
  })
  .openapi("CompletionUsage");

const FinishReason = z.enum(["stop", "length", "tool_calls", "content_filter"]);

export const ChatCompletion = z
  .object({
    id: z.string(),
    object: z.literal("chat.completion"),
    created: z.number().int(),
    model: z.string(),
    choices: z.array(
      z.object({
        index: z.number().int(),
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().nullable(),
          tool_calls: z.array(ToolCall).optional(),
        }),
        finish_reason: FinishReason,
      }),
    ),
    usage: Usage,
  })
  .openapi("ChatCompletion");

export const ChatCompletionChunk = z
  .object({
    id: z.string(),
    object: z.literal("chat.completion.chunk"),
    created: z.number().int(),
    model: z.string(),
    choices: z.array(
      z.object({
        index: z.number().int(),
        delta: z.object({
          role: z.literal("assistant").optional(),
          content: z.string().nullable().optional(),
        }),
        finish_reason: FinishReason.nullable(),
      }),
    ),
    usage: Usage.nullable().optional(),
  })
  .openapi("ChatCompletionChunk");

export const EmbeddingRequest = z
  .object({
    model: z.string().openapi({ example: "rightpeople-embed" }),
    input: z.union([z.string(), z.array(z.string()).min(1)]),
    dimensions: z.number().int().positive().max(4096).optional(),
    encoding_format: z.enum(["float", "base64"]).optional(),
    user: z.string().optional(),
  })
  .openapi("EmbeddingRequest");

export const EmbeddingResponse = z
  .object({
    object: z.literal("list"),
    model: z.string(),
    data: z.array(
      z.object({
        object: z.literal("embedding"),
        index: z.number().int(),
        embedding: z.union([z.array(z.number()), z.string()]).openapi({
          description:
            "Float array, or base64-encoded little-endian float32 bytes when `encoding_format` is `base64`.",
        }),
      }),
    ),
    usage: z.object({ prompt_tokens: z.number().int(), total_tokens: z.number().int() }),
  })
  .openapi("EmbeddingResponse");

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequest>;
export type ChatCompletion = z.infer<typeof ChatCompletion>;
export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunk>;
