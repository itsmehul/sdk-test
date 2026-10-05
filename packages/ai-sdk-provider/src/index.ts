import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import {
  type FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";

export const DEFAULT_BASE_URL = "https://api.interfaze.ai/v1";

export type InterfazeChatModelId = "interfaze-beta" | (string & {});
export type InterfazeEmbeddingModelId = "interfaze-embed" | (string & {});

export interface InterfazeProviderSettings {
  /** Defaults to the `INTERFAZE_API_KEY` environment variable, read at request time. */
  apiKey?: string;
  /** Defaults to `INTERFAZE_BASE_URL`, then `https://api.interfaze.ai/v1`. */
  baseURL?: string;
  headers?: Record<string, string>;
  /** Custom fetch implementation, e.g. for proxies or tests. */
  fetch?: FetchFunction;
}

export type InterfazeProvider = OpenAICompatibleProvider<
  InterfazeChatModelId,
  InterfazeChatModelId,
  InterfazeEmbeddingModelId,
  string
>;

/**
 * Create an Interfaze provider for the Vercel AI SDK.
 *
 * @example
 * const interfaze = createInterfaze({ apiKey: process.env.INTERFAZE_API_KEY });
 * const { text } = await generateText({ model: interfaze("interfaze-beta"), prompt: "Hi" });
 */
export function createInterfaze(settings: InterfazeProviderSettings = {}): InterfazeProvider {
  const baseURL =
    withoutTrailingSlash(
      loadOptionalSetting({
        settingValue: settings.baseURL,
        environmentVariableName: "INTERFAZE_BASE_URL",
      }),
    ) ?? DEFAULT_BASE_URL;

  const authorizedFetch: FetchFunction = (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("authorization")) {
      const apiKey = loadApiKey({
        apiKey: settings.apiKey,
        environmentVariableName: "INTERFAZE_API_KEY",
        description: "Interfaze",
      });
      headers.set("Authorization", `Bearer ${apiKey}`);
    }
    return (settings.fetch ?? globalThis.fetch)(input, { ...init, headers });
  };

  return createOpenAICompatible({
    name: "interfaze",
    baseURL,
    headers: settings.headers,
    fetch: authorizedFetch,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
}

/** Default provider instance configured from environment variables. */
export const interfaze: InterfazeProvider = createInterfaze();
