from __future__ import annotations

import base64
import struct

import pytest

from interfaze import (
    AsyncInterfaze,
    AuthenticationError,
    BadRequestError,
    Interfaze,
    NotFoundError,
)


@pytest.fixture
def client(base_url: str, api_key: str) -> Interfaze:
    return Interfaze(api_key=api_key, base_url=base_url)


@pytest.fixture
def async_client(base_url: str, api_key: str) -> AsyncInterfaze:
    return AsyncInterfaze(api_key=api_key, base_url=base_url)


def test_models(client: Interfaze) -> None:
    models = client.models.list()
    assert "interfaze-beta" in [m.id for m in models.data]
    assert client.models.retrieve("interfaze-beta").object == "model"


def test_not_found(client: Interfaze) -> None:
    with pytest.raises(NotFoundError) as info:
        client.models.retrieve("nope")
    assert info.value.status_code == 404
    assert info.value.code == "model_not_found"
    assert info.value.request_id


def test_auth_error(base_url: str) -> None:
    with pytest.raises(AuthenticationError):
        Interfaze(api_key="wrong", base_url=base_url).models.list()


def test_validation_error(client: Interfaze) -> None:
    with pytest.raises(BadRequestError) as info:
        client.chat.completions.create(model="interfaze-beta", messages=[])
    assert info.value.param == "messages"


def test_chat_completion(client: Interfaze) -> None:
    completion = client.chat.completions.create(
        model="interfaze-beta",
        messages=[{"role": "user", "content": "Say hello."}],
        temperature=0,
        max_tokens=16,
    )
    choice = completion.choices[0]
    assert choice.message.role == "assistant"
    assert choice.message.content
    assert choice.finish_reason in ("stop", "length")
    assert completion.usage.completion_tokens > 0


def test_chat_stream(client: Interfaze) -> None:
    with client.chat.completions.create(
        model="interfaze-beta",
        messages=[{"role": "user", "content": "Count to three."}],
        stream=True,
        stream_options={"include_usage": True},
        max_tokens=16,
    ) as stream:
        chunks = list(stream)
    assert chunks[0].choices[0].delta.role == "assistant"
    text = "".join(c.choices[0].delta.content or "" for c in chunks if c.choices)
    assert text
    finish = [c.choices[0].finish_reason for c in chunks if c.choices]
    assert finish[-1] in ("stop", "length")
    assert chunks[-1].usage is not None
    assert chunks[-1].usage.completion_tokens > 0


def test_embeddings(client: Interfaze) -> None:
    res = client.embeddings.create(model="interfaze-embed", input=["a", "b"], dimensions=8)
    assert len(res.data) == 2
    assert isinstance(res.data[0].embedding, list)
    assert len(res.data[0].embedding) == 8


def test_embeddings_base64(client: Interfaze) -> None:
    floats = client.embeddings.create(model="interfaze-embed", input="a", dimensions=4)
    encoded = client.embeddings.create(
        model="interfaze-embed", input="a", dimensions=4, encoding_format="base64"
    )
    raw = encoded.data[0].embedding
    assert isinstance(raw, str)
    decoded = struct.unpack("<4f", base64.b64decode(raw))
    assert decoded == pytest.approx(floats.data[0].embedding, abs=1e-4)


async def test_async_chat(async_client: AsyncInterfaze) -> None:
    async with async_client:
        completion = await async_client.chat.completions.create(
            model="interfaze-beta",
            messages=[{"role": "user", "content": "Say hi."}],
            max_tokens=16,
        )
        assert completion.choices[0].message.content

        stream = await async_client.chat.completions.create(
            model="interfaze-beta",
            messages=[{"role": "user", "content": "Say hi."}],
            stream=True,
            max_tokens=16,
        )
        text = ""
        async for chunk in stream:
            text += chunk.choices[0].delta.content or "" if chunk.choices else ""
        assert text

        models = await async_client.models.list()
        assert models.data
