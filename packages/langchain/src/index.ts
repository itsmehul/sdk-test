import type { LangSmithParams } from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type BaseChatOpenAIFields,
  ChatOpenAICompletions,
  type ClientOptions,
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";

export const DEFAULT_BASE_URL = "https://api.interfaze.ai/v1";

type Connection = {
  /** Defaults to the `INTERFAZE_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to `INTERFAZE_BASE_URL`, then `https://api.interfaze.ai/v1`. */
  baseURL?: string;
  /** Extra options for the underlying OpenAI-compatible HTTP client, e.g. `fetch` or `defaultHeaders`. */
  configuration?: Omit<ClientOptions, "apiKey" | "baseURL">;
};

function connect({ apiKey, baseURL, configuration }: Connection) {
  const key = apiKey ?? getEnvironmentVariable("INTERFAZE_API_KEY");
  if (!key) {
    throw new Error(
      "Missing Interfaze API key. Pass `apiKey` or set the INTERFAZE_API_KEY environment variable.",
    );
  }
  return {
    apiKey: key,
    configuration: {
      ...configuration,
      baseURL: baseURL ?? getEnvironmentVariable("INTERFAZE_BASE_URL") ?? DEFAULT_BASE_URL,
    },
  };
}

export interface ChatInterfazeInput
  extends Omit<BaseChatOpenAIFields, "apiKey" | "openAIApiKey" | "configuration">,
    Connection {}

/**
 * Interfaze chat model for LangChain.js. Supports `invoke`, `stream`,
 * `batch`, tool calling and LangSmith tracing.
 *
 * @example
 * const model = new ChatInterfaze({ model: "interfaze-beta" });
 * const reply = await model.invoke("Hello");
 */
export class ChatInterfaze extends ChatOpenAICompletions {
  static override lc_name(): string {
    return "ChatInterfaze";
  }

  override get lc_secrets(): Record<string, string> {
    return { apiKey: "INTERFAZE_API_KEY" };
  }

  constructor(fields: ChatInterfazeInput = {}) {
    const { apiKey, baseURL, configuration, ...rest } = fields;
    super({
      model: "interfaze-beta",
      streamUsage: true,
      ...rest,
      ...connect({ apiKey, baseURL, configuration }),
    });
  }

  override _llmType(): string {
    return "interfaze";
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return { ...super.getLsParams(options), ls_provider: "interfaze" };
  }
}

export interface InterfazeEmbeddingsInput
  extends Omit<Partial<OpenAIEmbeddingsParams>, "encodingFormat">,
    Connection {}

/**
 * Interfaze embeddings for LangChain.js vector stores and retrievers.
 *
 * @example
 * const embeddings = new InterfazeEmbeddings({ model: "interfaze-embed" });
 * const vector = await embeddings.embedQuery("Hello");
 */
export class InterfazeEmbeddings extends OpenAIEmbeddings {
  constructor(fields: InterfazeEmbeddingsInput = {}) {
    const { apiKey, baseURL, configuration, ...rest } = fields;
    super({
      model: "interfaze-embed",
      ...rest,
      encodingFormat: "float",
      ...connect({ apiKey, baseURL, configuration }),
    });
  }
}
