from __future__ import annotations

import json
from typing import Any, cast

import httpx


class RightPeopleError(Exception):
    pass


class APIError(RightPeopleError):
    status_code: int
    response: httpx.Response
    body: Any
    request_id: str | None
    type: str | None
    code: str | None
    param: str | None

    def __init__(self, response: httpx.Response, body: Any, message: str | None = None) -> None:
        detail: dict[str, Any] = {}
        if isinstance(body, dict):
            error = cast(dict[str, Any], body).get("error")
            if isinstance(error, dict):
                detail = cast(dict[str, Any], error)
        super().__init__(
            message or detail.get("message") or f"Request failed with status {response.status_code}"
        )
        self.status_code = response.status_code
        self.response = response
        self.body = body
        self.request_id = response.headers.get("x-request-id")
        self.type = detail.get("type")
        self.code = detail.get("code")
        self.param = detail.get("param")

    @classmethod
    def from_response(cls, response: httpx.Response) -> APIError:
        try:
            body: Any = json.loads(response.text) if response.text else None
        except ValueError:
            body = response.text
        return _error_class_for(response.status_code)(response, body)


class BadRequestError(APIError):
    pass


class AuthenticationError(APIError):
    pass


class PermissionDeniedError(APIError):
    pass


class NotFoundError(APIError):
    pass


class ConflictError(APIError):
    pass


class UnprocessableEntityError(APIError):
    pass


class RateLimitError(APIError):
    @property
    def retry_after(self) -> float | None:
        """Seconds the server asked us to wait, when provided."""
        value = self.response.headers.get("retry-after")
        try:
            return float(value) if value is not None else None
        except ValueError:
            return None


class InternalServerError(APIError):
    pass


class APIConnectionError(RightPeopleError):
    def __init__(self, message: str = "Connection error") -> None:
        super().__init__(message)


class APITimeoutError(APIConnectionError):
    def __init__(self, message: str = "Request timed out") -> None:
        super().__init__(message)


_BY_STATUS: dict[int, type[APIError]] = {
    400: BadRequestError,
    401: AuthenticationError,
    403: PermissionDeniedError,
    404: NotFoundError,
    409: ConflictError,
    422: UnprocessableEntityError,
    429: RateLimitError,
}


def _error_class_for(status: int) -> type[APIError]:
    if status in _BY_STATUS:
        return _BY_STATUS[status]
    return InternalServerError if status >= 500 else APIError
