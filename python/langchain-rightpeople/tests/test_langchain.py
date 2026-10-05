from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage
from langchain_rightpeople import ChatRightPeople, RightPeopleEmbeddings
from pydantic import SecretStr


@pytest.fixture
def chat(base_url: str, api_key: str) -> ChatRightPeople:
    return ChatRightPeople(api_key=SecretStr(api_key), base_url=base_url, max_completion_tokens=16)


def test_invoke(chat: ChatRightPeople) -> None:
    reply = chat.invoke("Say hello.")
    assert isinstance(reply, AIMessage)
    assert reply.content
    assert reply.usage_metadata is not None
    assert reply.usage_metadata["output_tokens"] > 0


def test_stream(chat: ChatRightPeople) -> None:
    text = "".join(str(chunk.content) for chunk in chat.stream("Count to three."))
    assert text


async def test_ainvoke(chat: ChatRightPeople) -> None:
    reply = await chat.ainvoke("Say hi.")
    assert reply.content


def test_identity(chat: ChatRightPeople) -> None:
    assert chat._llm_type == "rightpeople"
    assert chat.model_name == "rightpeople-beta"
    assert chat._get_ls_params().get("ls_provider") == "rightpeople"


def test_reads_env(monkeypatch: pytest.MonkeyPatch, base_url: str, api_key: str) -> None:
    monkeypatch.setenv("RIGHTPEOPLE_API_KEY", api_key)
    monkeypatch.setenv("RIGHTPEOPLE_BASE_URL", base_url)
    assert ChatRightPeople(max_completion_tokens=8).invoke("Say hi.").content


def test_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RIGHTPEOPLE_API_KEY", raising=False)
    with pytest.raises(ValueError, match="API key"):
        ChatRightPeople()


def test_embeddings(base_url: str, api_key: str) -> None:
    embeddings = RightPeopleEmbeddings(api_key=SecretStr(api_key), base_url=base_url, dimensions=16)
    docs = embeddings.embed_documents(["a", "b", "c"])
    assert len(docs) == 3
    assert len(docs[0]) == 16
    assert embeddings.embed_query("a") == pytest.approx(docs[0], abs=1e-4)
