import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import type { Engine } from "../engine";
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

const toUsage = (promptTokens: number, completionTokens: number) => ({
  prompt_tokens: promptTokens,
  completion_tokens: completionTokens,
  total_tokens: promptTokens + completionTokens,
});

export const chat = (engine: Engine) =>
  new OpenAPIHono().openapi(createChatCompletion, async (c) => {
    const body = c.req.valid("json");
    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (!body.stream) {
      const result = await engine.complete(body);
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
              finish_reason: result.finishReason,
            },
          ],
          usage: toUsage(result.promptTokens, result.completionTokens),
        },
        200,
      );
    }

    const abort = new AbortController();
    const deltas = engine.stream(body, abort.signal);
    // Pull the first delta before opening the stream so backend failures surface as JSON errors.
    const first = await deltas.next();

    const base = { id, object: "chat.completion.chunk" as const, created, model: body.model };
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => abort.abort());
      const send = (chunk: ChatCompletionChunk) => stream.writeSSE({ data: JSON.stringify(chunk) });

      await send({
        ...base,
        choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
      });

      let next = first;
      while (!next.done && !stream.aborted) {
        const delta = next.value;
        if (delta.type === "content") {
          await send({
            ...base,
            choices: [{ index: 0, delta: { content: delta.content }, finish_reason: null }],
          });
        } else {
          await send({
            ...base,
            choices: [{ index: 0, delta: {}, finish_reason: delta.finishReason }],
          });
          if (body.stream_options?.include_usage) {
            await send({
              ...base,
              choices: [],
              usage: toUsage(delta.promptTokens, delta.completionTokens),
            });
          }
        }
        next = await deltas.next();
      }
      if (!stream.aborted) await stream.writeSSE({ data: "[DONE]" });
    });
  });
