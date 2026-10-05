from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal

from .._client import RequestOptions, Timeout
from .._generated.models import EmbeddingResponse

if TYPE_CHECKING:
    from .._client import AsyncAPIClient, SyncAPIClient


def _body(
    model: str,
    input: str | list[str],
    dimensions: int | None,
    encoding_format: Literal["float", "base64"] | None,
    user: str | None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"model": model, "input": input}
    optional = {"dimensions": dimensions, "encoding_format": encoding_format, "user": user}
    body.update({key: value for key, value in optional.items() if value is not None})
    return body


class Embeddings:
    def __init__(self, client: SyncAPIClient) -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        input: str | list[str],
        dimensions: int | None = None,
        encoding_format: Literal["float", "base64"] | None = None,
        user: str | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
    ) -> EmbeddingResponse:
        return self._client.parse(
            EmbeddingResponse,
            "POST",
            "/embeddings",
            body=_body(model, input, dimensions, encoding_format, user),
            options=RequestOptions(extra_headers, timeout, max_retries, idempotency_key),
        )


class AsyncEmbeddings:
    def __init__(self, client: AsyncAPIClient) -> None:
        self._client = client

    async def create(
        self,
        *,
        model: str,
        input: str | list[str],
        dimensions: int | None = None,
        encoding_format: Literal["float", "base64"] | None = None,
        user: str | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
    ) -> EmbeddingResponse:
        return await self._client.parse(
            EmbeddingResponse,
            "POST",
            "/embeddings",
            body=_body(model, input, dimensions, encoding_format, user),
            options=RequestOptions(extra_headers, timeout, max_retries, idempotency_key),
        )
