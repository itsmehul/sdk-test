from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterable, Iterator
from dataclasses import dataclass
from types import TracebackType
from typing import Any, Generic, TypeVar

import httpx
from pydantic import BaseModel

from ._errors import APIError

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class ServerSentEvent:
    data: str
    event: str | None = None
    id: str | None = None


class SSEDecoder:
    """Incremental server-sent events decoder fed one line at a time."""

    def __init__(self) -> None:
        self._data: list[str] = []
        self._event: str | None = None
        self._id: str | None = None

    def decode(self, line: str) -> ServerSentEvent | None:
        line = line.rstrip("\r\n")
        if not line:
            return self.flush()
        if line.startswith(":"):
            return None
        field, _, value = line.partition(":")
        value = value.removeprefix(" ")
        if field == "data":
            self._data.append(value)
        elif field == "event":
            self._event = value
        elif field == "id":
            self._id = value
        return None

    def flush(self) -> ServerSentEvent | None:
        event = (
            ServerSentEvent(data="\n".join(self._data), event=self._event, id=self._id)
            if self._data
            else None
        )
        self._data = []
        self._event = None
        return event


def iter_events(lines: Iterable[str]) -> Iterator[ServerSentEvent]:
    decoder = SSEDecoder()
    for line in lines:
        if event := decoder.decode(line):
            yield event
    if event := decoder.flush():
        yield event


def _parse(event: ServerSentEvent, response: httpx.Response, model: type[T]) -> T | None:
    if event.data == "[DONE]":
        return None
    payload: Any = json.loads(event.data)
    if isinstance(payload, dict) and "error" in payload:
        raise APIError(response, payload)
    return model.model_validate(payload)


class Stream(Generic[T]):
    """Iterator over a streamed response. Use as a context manager or call `close()`."""

    def __init__(self, response: httpx.Response, model: type[T]) -> None:
        self.response = response
        self._model = model
        self._iterator = self._stream()

    def _stream(self) -> Iterator[T]:
        try:
            for event in iter_events(self.response.iter_lines()):
                item = _parse(event, self.response, self._model)
                if item is None:
                    return
                yield item
        finally:
            self.response.close()

    def __iter__(self) -> Iterator[T]:
        return self._iterator

    def __next__(self) -> T:
        return next(self._iterator)

    def close(self) -> None:
        self.response.close()

    def __enter__(self) -> Stream[T]:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()


class AsyncStream(Generic[T]):
    """Async iterator over a streamed response. Use as a context manager or call `aclose()`."""

    def __init__(self, response: httpx.Response, model: type[T]) -> None:
        self.response = response
        self._model = model
        self._iterator = self._stream()

    async def _stream(self) -> AsyncIterator[T]:
        decoder = SSEDecoder()
        try:
            async for line in self.response.aiter_lines():
                event = decoder.decode(line)
                if event is None:
                    continue
                item = _parse(event, self.response, self._model)
                if item is None:
                    return
                yield item
            if (event := decoder.flush()) and (item := _parse(event, self.response, self._model)):
                yield item
        finally:
            await self.response.aclose()

    def __aiter__(self) -> AsyncIterator[T]:
        return self._iterator

    async def __anext__(self) -> T:
        return await self._iterator.__anext__()

    async def aclose(self) -> None:
        await self.response.aclose()

    async def __aenter__(self) -> AsyncStream[T]:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()
