from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage
from langchain_interfaze import ChatInterfaze, InterfazeEmbeddings
from pydantic import SecretStr


@pytest.fixture
def chat(base_url: str, api_key: str) -> ChatInterfaze:
    return ChatInterfaze(api_key=SecretStr(api_key), base_url=base_url)


def test_invoke(chat: ChatInterfaze) -> None:
    reply = chat.invoke("hi langchain")
    assert isinstance(reply, AIMessage)
    assert reply.content == "Echo: hi langchain"
    assert reply.usage_metadata is not None
    assert reply.usage_metadata["output_tokens"] == 3


def test_stream(chat: ChatInterfaze) -> None:
    text = "".join(str(chunk.content) for chunk in chat.stream("token by token"))
    assert text == "Echo: token by token"


async def test_ainvoke(chat: ChatInterfaze) -> None:
    reply = await chat.ainvoke("async langchain")
    assert reply.content == "Echo: async langchain"


def test_identity(chat: ChatInterfaze) -> None:
    assert chat._llm_type == "interfaze"
    assert chat.model_name == "interfaze-beta"
    assert chat._get_ls_params().get("ls_provider") == "interfaze"


def test_reads_env(monkeypatch: pytest.MonkeyPatch, base_url: str, api_key: str) -> None:
    monkeypatch.setenv("INTERFAZE_API_KEY", api_key)
    monkeypatch.setenv("INTERFAZE_BASE_URL", base_url)
    assert ChatInterfaze().invoke("from env").content == "Echo: from env"


def test_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INTERFAZE_API_KEY", raising=False)
    with pytest.raises(ValueError, match="API key"):
        ChatInterfaze()


def test_embeddings(base_url: str, api_key: str) -> None:
    embeddings = InterfazeEmbeddings(api_key=SecretStr(api_key), base_url=base_url, dimensions=16)
    docs = embeddings.embed_documents(["a", "b", "c"])
    assert len(docs) == 3
    assert len(docs[0]) == 16
    assert embeddings.embed_query("a") == pytest.approx(docs[0])
