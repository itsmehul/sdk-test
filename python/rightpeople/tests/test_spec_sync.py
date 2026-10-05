"""Guards hand-written signatures against drift from the generated OpenAPI types."""

from __future__ import annotations

import inspect

from rightpeople._generated import params
from rightpeople.resources.chat import ChatCompletionOptions, Completions
from rightpeople.resources.embeddings import Embeddings

REQUEST_OPTIONS = {"self", "extra_headers", "timeout", "max_retries", "idempotency_key"}


def test_chat_options_match_spec() -> None:
    spec = set(params.ChatCompletionRequest.__annotations__)
    explicit = set(inspect.signature(Completions.create).parameters) - REQUEST_OPTIONS - {"options"}
    assert explicit | set(ChatCompletionOptions.__annotations__) == spec


def test_embedding_params_match_spec() -> None:
    spec = set(params.EmbeddingRequest.__annotations__)
    explicit = set(inspect.signature(Embeddings.create).parameters) - REQUEST_OPTIONS
    assert explicit == spec
