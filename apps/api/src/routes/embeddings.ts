import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type Engine, toBase64 } from "../engine";
import { EmbeddingRequest, EmbeddingResponse, ErrorResponse } from "../schemas";

const createEmbedding = createRoute({
  method: "post",
  path: "/embeddings",
  operationId: "createEmbedding",
  tags: ["Embeddings"],
  summary: "Create embeddings",
  request: {
    body: { required: true, content: { "application/json": { schema: EmbeddingRequest } } },
  },
  responses: {
    200: {
      description: "Embeddings",
      content: { "application/json": { schema: EmbeddingResponse } },
    },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponse } } },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

export const embeddings = (engine: Engine) =>
  new OpenAPIHono().openapi(createEmbedding, async (c) => {
    const body = c.req.valid("json");
    const inputs = typeof body.input === "string" ? [body.input] : body.input;
    const { embeddings, promptTokens } = await engine.embed(inputs, body.dimensions);
    return c.json(
      {
        object: "list" as const,
        model: body.model,
        data: embeddings.map((vector, index) => ({
          object: "embedding" as const,
          index,
          embedding: body.encoding_format === "base64" ? toBase64(vector) : vector,
        })),
        usage: { prompt_tokens: promptTokens, total_tokens: promptTokens },
      },
      200,
    );
  });
