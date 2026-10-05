from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx
import rightpeople._client
import pytest

from rightpeople import (
    APIConnectionError,
    APITimeoutError,
    AsyncRightPeople,
    BadRequestError,
    RightPeople,
    RightPeopleError,
    InternalServerError,
    RateLimitError,
)

MODELS: dict[str, Any] = {"object": "list", "data": []}
EMBEDDINGS: dict[str, Any] = {
    "object": "list",
    "model": "m",
    "data": [],
    "usage": {"prompt_tokens": 0, "total_tokens": 0},
}

Responder = Callable[[httpx.Request], httpx.Response]


def _no_delay(*_args: object, **_kwargs: object) -> float:
    return 0.0


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rightpeople._client, "retry_delay", _no_delay)


def make_client(
    responses: list[httpx.Response | Exception], **kwargs: int
) -> tuple[RightPeople, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        next_item = responses.pop(0)
        if isinstance(next_item, Exception):
            raise next_item
        return next_item

    client = RightPeople(
        api_key="k",
        base_url="http://test/v1",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        **kwargs,  # pyright: ignore[reportArgumentType]
    )
    return client, seen


def test_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RIGHTPEOPLE_API_KEY", raising=False)
    with pytest.raises(RightPeopleError):
        RightPeople()


def test_sends_auth_and_sdk_headers() -> None:
    client, seen = make_client([httpx.Response(200, json=MODELS)])
    client.models.list()
    assert seen[0].headers["authorization"] == "Bearer k"
    assert seen[0].headers["x-rightpeople-sdk"].startswith("python/")


def test_retries_5xx_with_same_idempotency_key() -> None:
    client, seen = make_client(
        [httpx.Response(503), httpx.Response(500), httpx.Response(200, json=EMBEDDINGS)]
    )
    client.embeddings.create(model="m", input="x")
    assert len(seen) == 3
    assert len({r.headers["idempotency-key"] for r in seen}) == 1
    assert [r.headers["x-rightpeople-retry-count"] for r in seen] == ["0", "1", "2"]


def test_gives_up_after_max_retries() -> None:
    client, seen = make_client(
        [
            httpx.Response(429, json={"error": {"message": "slow"}}, headers={"retry-after": "3"}),
            httpx.Response(429, json={"error": {"message": "slow"}}, headers={"retry-after": "3"}),
        ],
        max_retries=1,
    )
    with pytest.raises(RateLimitError) as info:
        client.models.list()
    assert len(seen) == 2
    assert info.value.retry_after == 3
    assert str(info.value) == "slow"


def test_no_retry_on_4xx() -> None:
    client, seen = make_client([httpx.Response(400, json={"error": {"message": "bad"}})])
    with pytest.raises(BadRequestError):
        client.models.list()
    assert len(seen) == 1


def test_honors_x_should_retry_false() -> None:
    client, seen = make_client([httpx.Response(500, headers={"x-should-retry": "false"})])
    with pytest.raises(InternalServerError):
        client.models.list()
    assert len(seen) == 1


def test_wraps_connection_errors() -> None:
    client, _ = make_client([httpx.ConnectError("down")], max_retries=0)
    with pytest.raises(APIConnectionError):
        client.models.list()


def test_wraps_timeouts_after_retrying() -> None:
    client, seen = make_client(
        [httpx.ReadTimeout("slow"), httpx.ReadTimeout("slow")], max_retries=1
    )
    with pytest.raises(APITimeoutError):
        client.models.list()
    assert len(seen) == 2


async def test_async_retries() -> None:
    responses = [httpx.Response(502), httpx.Response(200, json=MODELS)]
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return responses.pop(0)

    client = AsyncRightPeople(
        api_key="k",
        base_url="http://test/v1",
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    await client.models.list()
    assert len(calls) == 2
