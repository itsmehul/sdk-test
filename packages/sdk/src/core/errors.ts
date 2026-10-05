export class InterfazeError extends Error {
  override name = "InterfazeError";
}

type ErrorBody = {
  error?: { message?: string; type?: string; code?: string | null; param?: string | null };
};

export class APIError extends InterfazeError {
  override name = "APIError";
  readonly status: number;
  readonly headers: Headers;
  readonly requestId: string | null;
  readonly type: string | null;
  readonly code: string | null;
  readonly param: string | null;
  readonly body: unknown;

  constructor(status: number, body: unknown, headers: Headers, message?: string) {
    const detail = (body as ErrorBody | undefined)?.error;
    super(message ?? detail?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.headers = headers;
    this.body = body;
    this.requestId = headers.get("x-request-id");
    this.type = detail?.type ?? null;
    this.code = detail?.code ?? null;
    this.param = detail?.param ?? null;
  }

  static async fromResponse(response: Response): Promise<APIError> {
    const text = await response.text().catch(() => "");
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {}
    const Ctor = errorClassFor(response.status);
    return new Ctor(response.status, body, response.headers);
  }
}

export class BadRequestError extends APIError {
  override name = "BadRequestError";
}
export class AuthenticationError extends APIError {
  override name = "AuthenticationError";
}
export class PermissionDeniedError extends APIError {
  override name = "PermissionDeniedError";
}
export class NotFoundError extends APIError {
  override name = "NotFoundError";
}
export class ConflictError extends APIError {
  override name = "ConflictError";
}
export class UnprocessableEntityError extends APIError {
  override name = "UnprocessableEntityError";
}
export class RateLimitError extends APIError {
  override name = "RateLimitError";
  /** Seconds the server asked us to wait, when provided. */
  get retryAfter(): number | null {
    const value = this.headers.get("retry-after");
    const seconds = value == null ? Number.NaN : Number(value);
    return Number.isFinite(seconds) ? seconds : null;
  }
}
export class InternalServerError extends APIError {
  override name = "InternalServerError";
}

export class APIConnectionError extends InterfazeError {
  override name = "APIConnectionError";
  constructor(message = "Connection error", options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class APIConnectionTimeoutError extends APIConnectionError {
  override name = "APIConnectionTimeoutError";
  constructor(message = "Request timed out") {
    super(message);
  }
}

export class APIUserAbortError extends InterfazeError {
  override name = "APIUserAbortError";
  constructor(message = "Request was aborted") {
    super(message);
  }
}

function errorClassFor(status: number): typeof APIError {
  switch (status) {
    case 400:
      return BadRequestError;
    case 401:
      return AuthenticationError;
    case 403:
      return PermissionDeniedError;
    case 404:
      return NotFoundError;
    case 409:
      return ConflictError;
    case 422:
      return UnprocessableEntityError;
    case 429:
      return RateLimitError;
    default:
      return status >= 500 ? InternalServerError : APIError;
  }
}
