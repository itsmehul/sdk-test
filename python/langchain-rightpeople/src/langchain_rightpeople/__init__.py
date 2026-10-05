from __future__ import annotations

import os
from typing import Any, cast

from langchain_core.language_models.base import LangSmithParams
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import Field, model_validator

DEFAULT_BASE_URL = "https://api.rightpeople.ai/v1"

__all__ = ["DEFAULT_BASE_URL", "ChatRightPeople", "RightPeopleEmbeddings"]


def _with_connection(values: Any) -> Any:
    """Fill the OpenAI-compatible client settings from RightPeople env vars before validation."""
    if not isinstance(values, dict):
        return values
    values = dict(cast(dict[str, Any], values))
    if values.get("api_key") is None and values.get("openai_api_key") is None:
        api_key = os.environ.get("RIGHTPEOPLE_API_KEY")
        if not api_key:
            raise ValueError(
                "Missing RightPeople API key. Pass `api_key` or set the RIGHTPEOPLE_API_KEY "
                "environment variable."
            )
        values["api_key"] = api_key
    if values.get("base_url") is None and values.get("openai_api_base") is None:
        values["base_url"] = os.environ.get("RIGHTPEOPLE_BASE_URL", DEFAULT_BASE_URL)
    return values


class ChatRightPeople(ChatOpenAI):
    """RightPeople chat model for LangChain.

    Supports `invoke`, `stream`, `batch`, async variants, tool calling and LangSmith tracing.

    >>> model = ChatRightPeople(model="rightpeople-beta")  # reads RIGHTPEOPLE_API_KEY
    >>> model.invoke("Hello")
    """

    model_name: str = Field(default="rightpeople-beta", alias="model")
    stream_usage: bool | None = True
    use_responses_api: bool | None = False

    @model_validator(mode="before")
    @classmethod
    def _rightpeople_connection(cls, values: Any) -> Any:
        return _with_connection(values)

    @property
    def _llm_type(self) -> str:
        return "rightpeople"

    @property
    def lc_secrets(self) -> dict[str, str]:
        return {"openai_api_key": "RIGHTPEOPLE_API_KEY"}

    @classmethod
    def get_lc_namespace(cls) -> list[str]:
        return ["langchain_rightpeople"]

    def _get_ls_params(self, stop: list[str] | None = None, **kwargs: Any) -> LangSmithParams:
        params = super()._get_ls_params(stop=stop, **kwargs)
        params["ls_provider"] = "rightpeople"
        return params


class RightPeopleEmbeddings(OpenAIEmbeddings):
    """RightPeople embeddings for LangChain vector stores and retrievers.

    >>> embeddings = RightPeopleEmbeddings(model="rightpeople-embed")
    >>> embeddings.embed_query("Hello")
    """

    model: str = "rightpeople-embed"
    check_embedding_ctx_length: bool = False
    tiktoken_enabled: bool = False

    @model_validator(mode="before")
    @classmethod
    def _rightpeople_connection(cls, values: Any) -> Any:
        return _with_connection(values)
