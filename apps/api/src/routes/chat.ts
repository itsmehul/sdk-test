import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import { complete, tokenize } from "../engine";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ErrorResponse,
} from "../schemas";

const createChatCompletion = createRoute({
  method: "post",
  path: "/chat/completions",
  operationId: "createChatCompletion",
  tags: ["Chat"],
  summary: "Create a chat completion",
  description:
    "OpenAI-compatible chat completion. Set `stream: true` to receive `chat.completion.chunk` server-sent events terminated by `data: [DONE]`.",
  request: {
    body: { required: true, content: { "application/json": { schema: ChatCompletionRequest } } },
  },
  responses: {
    200: {
      description: "Completion, or an SSE stream of chunks when `stream` is true",
      content: {
        "application/json": { schema: ChatCompletion },
        "text/event-stream": { schema: ChatCompletionChunk },
      },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
    429: {
      description: "Rate limited",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const chat = new OpenAPIHono().openapi(createChatCompletion, async (c) => {
  const body = c.req.valid("json");
  const result = complete(body);
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const usage = {
    prompt_tokens: result.promptTokens,
    completion_tokens: result.completionTokens,
    total_tokens: result.promptTokens + result.completionTokens,
  };

  if (!body.stream) {
    return c.json(
      {
        id,
        object: "chat.completion" as const,
        created,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant" as const, content: result.content },
            finish_reason: "stop" as const,
          },
        ],
        usage,
      },
      200,
    );
  }

  const base = { id, object: "chat.completion.chunk" as const, created, model: body.model };
  return streamSSE(c, async (stream) => {
    const send = (chunk: ChatCompletionChunk) => stream.writeSSE({ data: JSON.stringify(chunk) });

    await send({
      ...base,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    });
    for (const token of tokenize(result.content)) {
      if (stream.aborted) return;
      await send({
        ...base,
        choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
      });
    }
    await send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    if (body.stream_options?.include_usage) {
      await send({ ...base, choices: [], usage });
    }
    await stream.writeSSE({ data: "[DONE]" });
  });
});
