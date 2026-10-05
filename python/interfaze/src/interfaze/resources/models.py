from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING
from urllib.parse import quote

from .._client import RequestOptions, Timeout
from .._generated.models import Model, ModelList

if TYPE_CHECKING:
    from .._client import AsyncAPIClient, SyncAPIClient


class Models:
    def __init__(self, client: SyncAPIClient) -> None:
        self._client = client

    def list(
        self,
        *,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
    ) -> ModelList:
        options = RequestOptions(extra_headers, timeout, max_retries)
        return self._client.parse(ModelList, "GET", "/models", options=options)

    def retrieve(
        self,
        model: str,
        *,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
    ) -> Model:
        options = RequestOptions(extra_headers, timeout, max_retries)
        return self._client.parse(Model, "GET", f"/models/{quote(model, safe='')}", options=options)


class AsyncModels:
    def __init__(self, client: AsyncAPIClient) -> None:
        self._client = client

    async def list(
        self,
        *,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
    ) -> ModelList:
        options = RequestOptions(extra_headers, timeout, max_retries)
        return await self._client.parse(ModelList, "GET", "/models", options=options)

    async def retrieve(
        self,
        model: str,
        *,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
    ) -> Model:
        options = RequestOptions(extra_headers, timeout, max_retries)
        path = f"/models/{quote(model, safe='')}"
        return await self._client.parse(Model, "GET", path, options=options)
