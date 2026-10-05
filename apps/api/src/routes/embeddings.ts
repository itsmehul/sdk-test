import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { countTokens, embed, toBase64 } from "../engine";
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

export const embeddings = new OpenAPIHono().openapi(createEmbedding, (c) => {
  const body = c.req.valid("json");
  const inputs = typeof body.input === "string" ? [body.input] : body.input;
  const tokens = inputs.reduce((sum, text) => sum + countTokens(text), 0);
  return c.json(
    {
      object: "list" as const,
      model: body.model,
      data: inputs.map((text, index) => ({
        object: "embedding" as const,
        index,
        embedding:
          body.encoding_format === "base64"
            ? toBase64(embed(text, body.dimensions))
            : embed(text, body.dimensions),
      })),
      usage: { prompt_tokens: tokens, total_tokens: tokens },
    },
    200,
  );
});
