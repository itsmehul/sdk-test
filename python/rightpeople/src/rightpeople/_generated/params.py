# Generated from openapi/openapi.json. Do not edit.

from __future__ import annotations

from typing import Any, Literal, TypeAlias, TypedDict

from typing_extensions import NotRequired


class Model(TypedDict):
    id: str
    object: Literal["model"]
    created: int
    owned_by: str


class Error(TypedDict):
    message: str
    type: str
    param: str | None
    code: str | None


class ErrorResponse(TypedDict):
    error: Error


class Function(TypedDict):
    name: str
    arguments: str


class ChatCompletionMessageToolCall(TypedDict):
    id: str
    type: Literal["function"]
    function: Function


class CompletionUsage(TypedDict):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class Delta(TypedDict):
    role: NotRequired[Literal["assistant"]]
    content: NotRequired[str | None]


class Choice1(TypedDict):
    index: int
    delta: Delta
    finish_reason: Literal["stop", "length", "tool_calls", "content_filter"] | None


class ChatCompletionChunk(TypedDict):
    id: str
    object: Literal["chat.completion.chunk"]
    created: int
    model: str
    choices: list[Choice1]
    usage: NotRequired[CompletionUsage]


class Function1(TypedDict):
    name: str


class ToolChoice(TypedDict):
    type: Literal["function"]
    function: Function1


class ResponseFormat(TypedDict):
    type: Literal["text"]


class ResponseFormat1(TypedDict):
    type: Literal["json_object"]


class JsonSchema(TypedDict):
    name: str
    schema: NotRequired[dict[str, Any]]
    strict: NotRequired[bool]


class ResponseFormat2(TypedDict):
    type: Literal["json_schema"]
    json_schema: JsonSchema


class StreamOptions(TypedDict):
    include_usage: NotRequired[bool]


class ChatCompletionContentPartText(TypedDict):
    type: Literal["text"]
    text: str


class ImageUrl(TypedDict):
    url: str
    detail: NotRequired[Literal["auto", "low", "high"]]


class ChatCompletionContentPartImage(TypedDict):
    type: Literal["image_url"]
    image_url: ImageUrl


class Function2(TypedDict):
    name: str
    description: NotRequired[str]
    parameters: NotRequired[dict[str, Any]]
    strict: NotRequired[bool]


class ChatCompletionTool(TypedDict):
    type: Literal["function"]
    function: Function2


class Datum(TypedDict):
    object: Literal["embedding"]
    index: int
    embedding: list[float] | str
    """
    Float array, or base64-encoded little-endian float32 bytes when `encoding_format` is `base64`.
    """


class Usage(TypedDict):
    prompt_tokens: int
    total_tokens: int


class EmbeddingResponse(TypedDict):
    object: Literal["list"]
    model: str
    data: list[Datum]
    usage: Usage


class EmbeddingRequest(TypedDict):
    model: str
    input: str | list[str]
    dimensions: NotRequired[int]
    encoding_format: NotRequired[Literal["float", "base64"]]
    user: NotRequired[str]


class ModelList(TypedDict):
    object: Literal["list"]
    data: list[Model]


class Message(TypedDict):
    role: Literal["assistant"]
    content: str | None
    tool_calls: NotRequired[list[ChatCompletionMessageToolCall]]


class Choice(TypedDict):
    index: int
    message: Message
    finish_reason: Literal["stop", "length", "tool_calls", "content_filter"]


class ChatCompletion(TypedDict):
    id: str
    object: Literal["chat.completion"]
    created: int
    model: str
    choices: list[Choice]
    usage: CompletionUsage


Content: TypeAlias = ChatCompletionContentPartText | ChatCompletionContentPartImage


class ChatCompletionMessage(TypedDict):
    role: Literal["system", "developer", "user", "assistant", "tool"]
    content: str | list[Content] | None
    name: NotRequired[str]
    tool_calls: NotRequired[list[ChatCompletionMessageToolCall]]
    tool_call_id: NotRequired[str]


class ChatCompletionRequest(TypedDict):
    model: str
    messages: list[ChatCompletionMessage]
    temperature: NotRequired[float]
    top_p: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    stop: NotRequired[str | list[str]]
    seed: NotRequired[int]
    tools: NotRequired[list[ChatCompletionTool]]
    tool_choice: NotRequired[Literal["none", "auto", "required"] | ToolChoice]
    response_format: NotRequired[ResponseFormat | ResponseFormat1 | ResponseFormat2]
    stream: NotRequired[bool]
    stream_options: NotRequired[StreamOptions]
    user: NotRequired[str]
