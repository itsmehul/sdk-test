from __future__ import annotations

import asyncio
import itertools
import os
import time
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from types import TracebackType
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel
from typing_extensions import Self

from ._errors import APIConnectionError, APIError, APITimeoutError, RightPeopleError
from ._retry import retry_delay, should_retry
from ._version import __version__

DEFAULT_BASE_URL = "https://api.rightpeople.ai/v1"
DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
DEFAULT_MAX_RETRIES = 2

M = TypeVar("M", bound=BaseModel)
Timeout = float | httpx.Timeout


@dataclass(frozen=True)
class RequestOptions:
    extra_headers: Mapping[str, str] | None = None
    timeout: Timeout | None = None
    max_retries: int | None = None
    idempotency_key: str | None = None


class _BaseClient:
    api_key: str
    base_url: str
    timeout: Timeout
    max_retries: int

    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str | None,
        timeout: Timeout | None,
        max_retries: int | None,
        default_headers: Mapping[str, str] | None,
    ) -> None:
        resolved_key = api_key or os.environ.get("RIGHTPEOPLE_API_KEY")
        if not resolved_key:
            raise RightPeopleError(
                "Missing API key. Pass `api_key` or set the RIGHTPEOPLE_API_KEY environment variable."
            )
        self.api_key = resolved_key
        self.base_url = (
            base_url or os.environ.get("RIGHTPEOPLE_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self.timeout = timeout if timeout is not None else DEFAULT_TIMEOUT
        self.max_retries = max_retries if max_retries is not None else DEFAULT_MAX_RETRIES
        self._default_headers = dict(default_headers or {})

    def _prepare(
        self,
        client: httpx.Client | httpx.AsyncClient,
        method: str,
        path: str,
        body: Any,
        options: RequestOptions,
        attempt: int,
        idempotency_key: str | None,
        stream: bool,
    ) -> httpx.Request:
        headers = {
            "Accept": "text/event-stream" if stream else "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-RightPeople-SDK": f"python/{__version__}",
            "X-RightPeople-Retry-Count": str(attempt),
            **self._default_headers,
            **(options.extra_headers or {}),
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return client.build_request(
            method,
            f"{self.base_url}{path}",
            json=body,
            headers=headers,
            timeout=options.timeout if options.timeout is not None else self.timeout,
        )

    def _idempotency_key(self, method: str, options: RequestOptions) -> str | None:
        if options.idempotency_key:
            return options.idempotency_key
        return f"ifz-retry-{uuid.uuid4()}" if method == "POST" else None


class SyncAPIClient(_BaseClient):
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
        )
        self._client = http_client or httpx.Client()

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        options: RequestOptions | None = None,
        stream: bool = False,
    ) -> httpx.Response:
        options = options or RequestOptions()
        max_retries = options.max_retries if options.max_retries is not None else self.max_retries
        idempotency_key = self._idempotency_key(method, options)

        for attempt in itertools.count():
            retries_left = attempt < max_retries
            request = self._prepare(
                self._client, method, path, body, options, attempt, idempotency_key, stream
            )
            try:
                response = self._client.send(request, stream=stream)
            except httpx.TimeoutException as error:
                if retries_left:
                    time.sleep(retry_delay(attempt))
                    continue
                raise APITimeoutError() from error
            except httpx.TransportError as error:
                if retries_left:
                    time.sleep(retry_delay(attempt))
                    continue
                raise APIConnectionError() from error

            if response.is_success:
                return response
            if retries_left and should_retry(response):
                response.close()
                time.sleep(retry_delay(attempt, response.headers))
                continue
            response.read()
            raise APIError.from_response(response)
        raise AssertionError("unreachable")  # pragma: no cover

    def parse(self, model: type[M], method: str, path: str, **kwargs: Any) -> M:
        return model.model_validate_json(self.request(method, path, **kwargs).content)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()


class AsyncAPIClient(_BaseClient):
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
        )
        self._client = http_client or httpx.AsyncClient()

    async def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        options: RequestOptions | None = None,
        stream: bool = False,
    ) -> httpx.Response:
        options = options or RequestOptions()
        max_retries = options.max_retries if options.max_retries is not None else self.max_retries
        idempotency_key = self._idempotency_key(method, options)

        for attempt in itertools.count():
            retries_left = attempt < max_retries
            request = self._prepare(
                self._client, method, path, body, options, attempt, idempotency_key, stream
            )
            try:
                response = await self._client.send(request, stream=stream)
            except httpx.TimeoutException as error:
                if retries_left:
                    await asyncio.sleep(retry_delay(attempt))
                    continue
                raise APITimeoutError() from error
            except httpx.TransportError as error:
                if retries_left:
                    await asyncio.sleep(retry_delay(attempt))
                    continue
                raise APIConnectionError() from error

            if response.is_success:
                return response
            if retries_left and should_retry(response):
                await response.aclose()
                await asyncio.sleep(retry_delay(attempt, response.headers))
                continue
            await response.aread()
            raise APIError.from_response(response)
        raise AssertionError("unreachable")  # pragma: no cover

    async def parse(self, model: type[M], method: str, path: str, **kwargs: Any) -> M:
        response = await self.request(method, path, **kwargs)
        return model.model_validate_json(response.content)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()
