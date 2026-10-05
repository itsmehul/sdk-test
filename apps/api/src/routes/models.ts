import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MODELS } from "../engine";
import { apiError } from "../errors";
import { ErrorResponse, Model, ModelList } from "../schemas";

const listModels = createRoute({
  method: "get",
  path: "/models",
  operationId: "listModels",
  tags: ["Models"],
  summary: "List available models",
  responses: {
    200: { description: "Model list", content: { "application/json": { schema: ModelList } } },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const retrieveModel = createRoute({
  method: "get",
  path: "/models/{model}",
  operationId: "retrieveModel",
  tags: ["Models"],
  summary: "Retrieve a model",
  request: {
    params: z.object({
      model: z
        .string()
        .openapi({ param: { name: "model", in: "path" }, example: "interfaze-beta" }),
    }),
  },
  responses: {
    200: { description: "Model", content: { "application/json": { schema: Model } } },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponse } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  },
});

const toModel = (m: (typeof MODELS)[number]) => ({ ...m, object: "model" as const });

export const models = new OpenAPIHono()
  .openapi(listModels, (c) => c.json({ object: "list" as const, data: MODELS.map(toModel) }, 200))
  .openapi(retrieveModel, (c) => {
    const { model } = c.req.valid("param");
    const found = MODELS.find((m) => m.id === model);
    if (!found) return apiError(c, 404, `Model '${model}' not found`, { code: "model_not_found" });
    return c.json(toModel(found), 200);
  });
