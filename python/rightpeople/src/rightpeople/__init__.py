from __future__ import annotations

from collections.abc import Mapping

import httpx

from . import types
from ._client import DEFAULT_BASE_URL, AsyncAPIClient, SyncAPIClient, Timeout
from ._errors import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    ConflictError,
    RightPeopleError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    UnprocessableEntityError,
)
from ._streaming import AsyncStream, ServerSentEvent, Stream
from ._version import __version__
from .resources import AsyncChat, AsyncEmbeddings, AsyncModels, Chat, Embeddings, Models


class RightPeople(SyncAPIClient):
    """RightPeople API client.

    Instances are independent, so create one per credential or configuration and share it.

    >>> client = RightPeople()  # reads RIGHTPEOPLE_API_KEY
    >>> client.chat.completions.create(
    ...     model="rightpeople-beta", messages=[{"role": "user", "content": "Hello"}]
    ... )
    """

    chat: Chat
    models: Models
    embeddings: Embeddings

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        default_headers: Mapping[str, str] | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        super().__init__(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers,
            http_client=http_client,
        )
        self.chat = Chat(self)
        self.models = Models(self)
        self.embeddings = Embeddings(self)


class AsyncRightPeople(AsyncAPIClient):
    """Async RightPeople API client. Same surface as `RightPeople` with awaitable methods."""

    chat: AsyncChat
    models: AsyncModels
    embeddings: AsyncEmbeddings

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        default_headers: Mapping[str, str] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        super().__init__(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            default_headers=default_headers,
            http_client=http_client,
        )
        self.chat = AsyncChat(self)
        self.models = AsyncModels(self)
        self.embeddings = AsyncEmbeddings(self)


__all__ = [
    "DEFAULT_BASE_URL",
    "APIConnectionError",
    "APIError",
    "APITimeoutError",
    "AsyncRightPeople",
    "AsyncStream",
    "AuthenticationError",
    "BadRequestError",
    "ConflictError",
    "RightPeople",
    "RightPeopleError",
    "InternalServerError",
    "NotFoundError",
    "PermissionDeniedError",
    "RateLimitError",
    "ServerSentEvent",
    "Stream",
    "UnprocessableEntityError",
    "__version__",
    "types",
]
