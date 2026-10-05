from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import TYPE_CHECKING, Any, Literal, TypedDict, overload

from typing_extensions import Unpack

from .._client import RequestOptions, Timeout
from .._generated import params
from .._generated.models import ChatCompletion, ChatCompletionChunk
from .._streaming import AsyncStream, Stream

if TYPE_CHECKING:
    from .._client import AsyncAPIClient, SyncAPIClient


class ChatCompletionOptions(TypedDict, total=False):
    """Optional `ChatCompletionRequest` fields. Kept in sync with the spec by tests."""

    temperature: float
    top_p: float
    max_tokens: int
    max_completion_tokens: int
    stop: str | list[str]
    seed: int
    tools: list[params.ChatCompletionTool]
    tool_choice: Literal["none", "auto", "required"] | params.ToolChoice
    response_format: params.ResponseFormat | params.ResponseFormat1 | params.ResponseFormat2
    stream_options: params.StreamOptions
    user: str


def _body(
    model: str,
    messages: Iterable[params.ChatCompletionMessage],
    stream: bool | None,
    options: ChatCompletionOptions,
) -> dict[str, Any]:
    body: dict[str, Any] = {"model": model, "messages": list(messages), **options}
    if stream:
        body["stream"] = True
    return body


class Completions:
    def __init__(self, client: SyncAPIClient) -> None:
        self._client = client

    @overload
    def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: Literal[False] | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> ChatCompletion: ...
    @overload
    def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: Literal[True],
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> Stream[ChatCompletionChunk]: ...
    def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: bool | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> ChatCompletion | Stream[ChatCompletionChunk]:
        """Create a chat completion. Pass `stream=True` to iterate over chunks."""
        body = _body(model, messages, stream, options)
        opts = RequestOptions(extra_headers, timeout, max_retries, idempotency_key)
        if stream:
            response = self._client.request(
                "POST", "/chat/completions", body=body, options=opts, stream=True
            )
            return Stream(response, ChatCompletionChunk)
        return self._client.parse(
            ChatCompletion, "POST", "/chat/completions", body=body, options=opts
        )


class AsyncCompletions:
    def __init__(self, client: AsyncAPIClient) -> None:
        self._client = client

    @overload
    async def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: Literal[False] | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> ChatCompletion: ...
    @overload
    async def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: Literal[True],
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> AsyncStream[ChatCompletionChunk]: ...
    async def create(
        self,
        *,
        model: str,
        messages: Iterable[params.ChatCompletionMessage],
        stream: bool | None = None,
        extra_headers: Mapping[str, str] | None = None,
        timeout: Timeout | None = None,
        max_retries: int | None = None,
        idempotency_key: str | None = None,
        **options: Unpack[ChatCompletionOptions],
    ) -> ChatCompletion | AsyncStream[ChatCompletionChunk]:
        """Create a chat completion. Pass `stream=True` to iterate over chunks."""
        body = _body(model, messages, stream, options)
        opts = RequestOptions(extra_headers, timeout, max_retries, idempotency_key)
        if stream:
            response = await self._client.request(
                "POST", "/chat/completions", body=body, options=opts, stream=True
            )
            return AsyncStream(response, ChatCompletionChunk)
        return await self._client.parse(
            ChatCompletion, "POST", "/chat/completions", body=body, options=opts
        )


class Chat:
    def __init__(self, client: SyncAPIClient) -> None:
        self.completions = Completions(client)


class AsyncChat:
    def __init__(self, client: AsyncAPIClient) -> None:
        self.completions = AsyncCompletions(client)
