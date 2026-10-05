import type { LangSmithParams } from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type BaseChatOpenAIFields,
  ChatOpenAICompletions,
  type ClientOptions,
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";

export const DEFAULT_BASE_URL = "https://api.rightpeople.ai/v1";

type Connection = {
  /** Defaults to the `RIGHTPEOPLE_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to `RIGHTPEOPLE_BASE_URL`, then `https://api.rightpeople.ai/v1`. */
  baseURL?: string;
  /** Extra options for the underlying OpenAI-compatible HTTP client, e.g. `fetch` or `defaultHeaders`. */
  configuration?: Omit<ClientOptions, "apiKey" | "baseURL">;
};

function connect({ apiKey, baseURL, configuration }: Connection) {
  const key = apiKey ?? getEnvironmentVariable("RIGHTPEOPLE_API_KEY");
  if (!key) {
    throw new Error(
      "Missing RightPeople API key. Pass `apiKey` or set the RIGHTPEOPLE_API_KEY environment variable.",
    );
  }
  return {
    apiKey: key,
    configuration: {
      ...configuration,
      baseURL: baseURL ?? getEnvironmentVariable("RIGHTPEOPLE_BASE_URL") ?? DEFAULT_BASE_URL,
    },
  };
}

export interface ChatRightPeopleInput
  extends Omit<BaseChatOpenAIFields, "apiKey" | "openAIApiKey" | "configuration">,
    Connection {}

/**
 * RightPeople chat model for LangChain.js. Supports `invoke`, `stream`,
 * `batch`, tool calling and LangSmith tracing.
 *
 * @example
 * const model = new ChatRightPeople({ model: "rightpeople-beta" });
 * const reply = await model.invoke("Hello");
 */
export class ChatRightPeople extends ChatOpenAICompletions {
  static override lc_name(): string {
    return "ChatRightPeople";
  }

  override get lc_secrets(): Record<string, string> {
    return { apiKey: "RIGHTPEOPLE_API_KEY" };
  }

  constructor(fields: ChatRightPeopleInput = {}) {
    const { apiKey, baseURL, configuration, ...rest } = fields;
    super({
      model: "rightpeople-beta",
      streamUsage: true,
      ...rest,
      ...connect({ apiKey, baseURL, configuration }),
    });
  }

  override _llmType(): string {
    return "rightpeople";
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return { ...super.getLsParams(options), ls_provider: "rightpeople" };
  }
}

export interface RightPeopleEmbeddingsInput
  extends Omit<Partial<OpenAIEmbeddingsParams>, "encodingFormat">,
    Connection {}

/**
 * RightPeople embeddings for LangChain.js vector stores and retrievers.
 *
 * @example
 * const embeddings = new RightPeopleEmbeddings({ model: "rightpeople-embed" });
 * const vector = await embeddings.embedQuery("Hello");
 */
export class RightPeopleEmbeddings extends OpenAIEmbeddings {
  constructor(fields: RightPeopleEmbeddingsInput = {}) {
    const { apiKey, baseURL, configuration, ...rest } = fields;
    super({
      model: "rightpeople-embed",
      ...rest,
      encodingFormat: "float",
      ...connect({ apiKey, baseURL, configuration }),
    });
  }
}
