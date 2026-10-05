from __future__ import annotations

import os
from typing import Any, cast

from langchain_core.language_models.base import LangSmithParams
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import Field, model_validator

DEFAULT_BASE_URL = "https://api.interfaze.ai/v1"

__all__ = ["DEFAULT_BASE_URL", "ChatInterfaze", "InterfazeEmbeddings"]


def _with_connection(values: Any) -> Any:
    """Fill the OpenAI-compatible client settings from Interfaze env vars before validation."""
    if not isinstance(values, dict):
        return values
    values = dict(cast(dict[str, Any], values))
    if values.get("api_key") is None and values.get("openai_api_key") is None:
        api_key = os.environ.get("INTERFAZE_API_KEY")
        if not api_key:
            raise ValueError(
                "Missing Interfaze API key. Pass `api_key` or set the INTERFAZE_API_KEY "
                "environment variable."
            )
        values["api_key"] = api_key
    if values.get("base_url") is None and values.get("openai_api_base") is None:
        values["base_url"] = os.environ.get("INTERFAZE_BASE_URL", DEFAULT_BASE_URL)
    return values


class ChatInterfaze(ChatOpenAI):
    """Interfaze chat model for LangChain.

    Supports `invoke`, `stream`, `batch`, async variants, tool calling and LangSmith tracing.

    >>> model = ChatInterfaze(model="interfaze-beta")  # reads INTERFAZE_API_KEY
    >>> model.invoke("Hello")
    """

    model_name: str = Field(default="interfaze-beta", alias="model")
    stream_usage: bool | None = True
    use_responses_api: bool | None = False

    @model_validator(mode="before")
    @classmethod
    def _interfaze_connection(cls, values: Any) -> Any:
        return _with_connection(values)

    @property
    def _llm_type(self) -> str:
        return "interfaze"

    @property
    def lc_secrets(self) -> dict[str, str]:
        return {"openai_api_key": "INTERFAZE_API_KEY"}

    @classmethod
    def get_lc_namespace(cls) -> list[str]:
        return ["langchain_interfaze"]

    def _get_ls_params(self, stop: list[str] | None = None, **kwargs: Any) -> LangSmithParams:
        params = super()._get_ls_params(stop=stop, **kwargs)
        params["ls_provider"] = "interfaze"
        return params


class InterfazeEmbeddings(OpenAIEmbeddings):
    """Interfaze embeddings for LangChain vector stores and retrievers.

    >>> embeddings = InterfazeEmbeddings(model="interfaze-embed")
    >>> embeddings.embed_query("Hello")
    """

    model: str = "interfaze-embed"
    check_embedding_ctx_length: bool = False
    tiktoken_enabled: bool = False

    @model_validator(mode="before")
    @classmethod
    def _interfaze_connection(cls, values: Any) -> Any:
        return _with_connection(values)
