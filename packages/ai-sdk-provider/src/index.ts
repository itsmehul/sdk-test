import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import {
  type FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";

export const DEFAULT_BASE_URL = "https://api.rightpeople.ai/v1";

export type RightPeopleChatModelId = "rightpeople-beta" | (string & {});
export type RightPeopleEmbeddingModelId = "rightpeople-embed" | (string & {});

export interface RightPeopleProviderSettings {
  /** Defaults to the `RIGHTPEOPLE_API_KEY` environment variable, read at request time. */
  apiKey?: string;
  /** Defaults to `RIGHTPEOPLE_BASE_URL`, then `https://api.rightpeople.ai/v1`. */
  baseURL?: string;
  headers?: Record<string, string>;
  /** Custom fetch implementation, e.g. for proxies or tests. */
  fetch?: FetchFunction;
}

export type RightPeopleProvider = OpenAICompatibleProvider<
  RightPeopleChatModelId,
  RightPeopleChatModelId,
  RightPeopleEmbeddingModelId,
  string
>;

/**
 * Create an RightPeople provider for the Vercel AI SDK.
 *
 * @example
 * const rightpeople = createRightPeople({ apiKey: process.env.RIGHTPEOPLE_API_KEY });
 * const { text } = await generateText({ model: rightpeople("rightpeople-beta"), prompt: "Hi" });
 */
export function createRightPeople(settings: RightPeopleProviderSettings = {}): RightPeopleProvider {
  const baseURL =
    withoutTrailingSlash(
      loadOptionalSetting({
        settingValue: settings.baseURL,
        environmentVariableName: "RIGHTPEOPLE_BASE_URL",
      }),
    ) ?? DEFAULT_BASE_URL;

  const authorizedFetch: FetchFunction = (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("authorization")) {
      const apiKey = loadApiKey({
        apiKey: settings.apiKey,
        environmentVariableName: "RIGHTPEOPLE_API_KEY",
        description: "RightPeople",
      });
      headers.set("Authorization", `Bearer ${apiKey}`);
    }
    return (settings.fetch ?? globalThis.fetch)(input, { ...init, headers });
  };

  return createOpenAICompatible({
    name: "rightpeople",
    baseURL,
    headers: settings.headers,
    fetch: authorizedFetch,
    includeUsage: true,
    supportsStructuredOutputs: true,
  });
}

/** Default provider instance configured from environment variables. */
export const rightpeople: RightPeopleProvider = createRightPeople();
