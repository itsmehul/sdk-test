import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const TYPES: Partial<Record<number, string>> = {
  400: "invalid_request_error",
  401: "authentication_error",
  403: "permission_error",
  404: "not_found_error",
  422: "invalid_request_error",
  429: "rate_limit_error",
};

export function apiError<S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  message: string,
  options: { code?: string; param?: string } = {},
) {
  return c.json(
    {
      error: {
        message,
        type: TYPES[status] ?? "api_error",
        param: options.param ?? null,
        code: options.code ?? null,
      },
    },
    status,
  );
}
