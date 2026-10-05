import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { type Engine, engineFromEnv, UpstreamError } from "./engine";
import { apiError } from "./errors";
import { chat } from "./routes/chat";
import { embeddings } from "./routes/embeddings";
import { models } from "./routes/models";

export const openAPIConfig: Parameters<OpenAPIHono["getOpenAPI31Document"]>[0] = {
  openapi: "3.1.0",
  info: {
    title: "Interfaze API",
    version: "1.0.0",
    description: "OpenAI-compatible API for Interfaze models.",
  },
  servers: [{ url: "https://api.interfaze.ai", description: "Production" }],
  security: [{ bearerAuth: [] }],
};

export function createApp(options: { apiKey?: string; engine?: Engine } = {}) {
  const apiKey = options.apiKey ?? process.env.INTERFAZE_API_KEY;
  const engine = options.engine ?? engineFromEnv();

  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        return apiError(c, 400, issue?.message ?? "Invalid request", {
          param: issue?.path.join("."),
        });
      }
    },
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
  });

  app.use("*", requestId({ headerName: "x-request-id" }));
  app.use("/v1/*", cors());
  app.use(
    "/v1/*",
    bearerAuth({
      verifyToken: (token) => (apiKey ? token === apiKey : token.length > 0),
      noAuthenticationHeader: { message: { error: authError("Missing API key") } },
      invalidAuthenticationHeader: { message: { error: authError("Malformed API key") } },
      invalidToken: { message: { error: authError("Invalid API key") } },
    }),
  );

  app.route("/v1", models);
  app.route("/v1", chat(engine));
  app.route("/v1", embeddings(engine));

  app.doc31("/openapi.json", openAPIConfig);
  app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: "Interfaze API" }));
  app.get("/health", (c) => c.json({ ok: true }));

  app.notFound((c) => apiError(c, 404, `Route ${c.req.method} ${c.req.path} not found`));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    if (err instanceof UpstreamError) {
      if (err.retryAfter) c.header("retry-after", String(err.retryAfter));
      return apiError(c, err.status, err.message, { code: err.code });
    }
    console.error(err);
    return apiError(c, 500, "Internal server error");
  });

  return app;
}

function authError(message: string) {
  return { message, type: "authentication_error", param: null, code: "invalid_api_key" };
}

export type App = ReturnType<typeof createApp>;
export { type Engine, echoEngine, openAICompatibleEngine } from "./engine";
