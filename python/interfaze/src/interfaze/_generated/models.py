# Generated from openapi/openapi.json. Do not edit.

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, RootModel


class Model(BaseModel):
    id: Annotated[str, Field(examples=["interfaze-beta"])]
    object: Literal["model"]
    created: int
    owned_by: str


class Error(BaseModel):
    message: str
    type: Annotated[str, Field(examples=["invalid_request_error"])]
    param: str | None
    code: str | None


class ErrorResponse(BaseModel):
    error: Error


class Function(BaseModel):
    name: str
    arguments: str


class ChatCompletionMessageToolCall(BaseModel):
    id: str
    type: Literal["function"]
    function: Function


class CompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class Delta(BaseModel):
    role: Literal["assistant"] | None = None
    content: str | None = None


class Choice1(BaseModel):
    index: int
    delta: Delta
    finish_reason: Literal["stop", "length", "tool_calls", "content_filter"] | None


class ChatCompletionChunk(BaseModel):
    id: str
    object: Literal["chat.completion.chunk"]
    created: int
    model: str
    choices: list[Choice1]
    usage: CompletionUsage | None = None


class Function1(BaseModel):
    name: str


class ToolChoice(BaseModel):
    type: Literal["function"]
    function: Function1


class ResponseFormat(BaseModel):
    type: Literal["text"]


class ResponseFormat1(BaseModel):
    type: Literal["json_object"]


class JsonSchema(BaseModel):
    name: str
    schema_: Annotated[dict[str, Any] | None, Field(alias="schema")] = None
    strict: bool | None = None


class ResponseFormat2(BaseModel):
    type: Literal["json_schema"]
    json_schema: JsonSchema


class StreamOptions(BaseModel):
    include_usage: bool | None = None


class ChatCompletionContentPartText(BaseModel):
    type: Literal["text"]
    text: str


class ImageUrl(BaseModel):
    url: str
    detail: Literal["auto", "low", "high"] | None = None


class ChatCompletionContentPartImage(BaseModel):
    type: Literal["image_url"]
    image_url: ImageUrl


class Function2(BaseModel):
    name: str
    description: str | None = None
    parameters: dict[str, Any] | None = None
    strict: bool | None = None


class ChatCompletionTool(BaseModel):
    type: Literal["function"]
    function: Function2


class Datum(BaseModel):
    object: Literal["embedding"]
    index: int
    embedding: list[float] | str
    """
    Float array, or base64-encoded little-endian float32 bytes when `encoding_format` is `base64`.
    """


class Usage(BaseModel):
    prompt_tokens: int
    total_tokens: int


class EmbeddingResponse(BaseModel):
    object: Literal["list"]
    model: str
    data: list[Datum]
    usage: Usage


class Input(RootModel[list[str]]):
    root: Annotated[list[str], Field(min_length=1)]


class EmbeddingRequest(BaseModel):
    model: Annotated[str, Field(examples=["interfaze-embed"])]
    input: str | Input
    dimensions: Annotated[int | None, Field(gt=0, le=4096)] = None
    encoding_format: Literal["float", "base64"] | None = None
    user: str | None = None


class ModelList(BaseModel):
    object: Literal["list"]
    data: list[Model]


class Message(BaseModel):
    role: Literal["assistant"]
    content: str | None
    tool_calls: list[ChatCompletionMessageToolCall] | None = None


class Choice(BaseModel):
    index: int
    message: Message
    finish_reason: Literal["stop", "length", "tool_calls", "content_filter"]


class ChatCompletion(BaseModel):
    id: str
    object: Literal["chat.completion"]
    created: int
    model: str
    choices: list[Choice]
    usage: CompletionUsage


class Content(RootModel[ChatCompletionContentPartText | ChatCompletionContentPartImage]):
    root: Annotated[
        ChatCompletionContentPartText | ChatCompletionContentPartImage, Field(discriminator="type")
    ]


class ChatCompletionMessage(BaseModel):
    role: Literal["system", "developer", "user", "assistant", "tool"]
    content: str | list[Content] | None
    name: str | None = None
    tool_calls: list[ChatCompletionMessageToolCall] | None = None
    tool_call_id: str | None = None


class ChatCompletionRequest(BaseModel):
    model: Annotated[str, Field(examples=["interfaze-beta"])]
    messages: Annotated[list[ChatCompletionMessage], Field(min_length=1)]
    temperature: Annotated[float | None, Field(ge=0.0, le=2.0)] = None
    top_p: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
    max_tokens: Annotated[int | None, Field(gt=0)] = None
    max_completion_tokens: Annotated[int | None, Field(gt=0)] = None
    stop: str | list[str] | None = None
    seed: int | None = None
    tools: list[ChatCompletionTool] | None = None
    tool_choice: Literal["none", "auto", "required"] | ToolChoice | None = None
    response_format: ResponseFormat | ResponseFormat1 | ResponseFormat2 | None = None
    stream: bool | None = None
    stream_options: StreamOptions | None = None
    user: str | None = None
