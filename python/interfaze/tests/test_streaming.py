from __future__ import annotations

import httpx
import pytest
from interfaze._streaming import iter_events
from pydantic import BaseModel

from interfaze import APIError, ServerSentEvent, Stream


class Item(BaseModel):
    n: int


def test_parses_crlf_comments_and_multiline_data() -> None:
    lines = [": ping", "event: a", "data: one", "data: two", "", "data: x"]
    assert list(iter_events(lines)) == [
        ServerSentEvent(data="one\ntwo", event="a"),
        ServerSentEvent(data="x"),
    ]


def _stream(body: str) -> Stream[Item]:
    return Stream(httpx.Response(200, content=body.encode()), Item)


def test_stops_at_done() -> None:
    assert [i.n for i in _stream('data: {"n":1}\n\ndata: [DONE]\n\ndata: {"n":2}\n\n')] == [1]


def test_raises_error_events() -> None:
    with pytest.raises(APIError, match="boom"):
        list(_stream('data: {"error":{"message":"boom"}}\n\n'))
