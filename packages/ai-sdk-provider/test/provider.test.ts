import { createApp, echoEngine } from "@interfaze/api";
import { embedMany, generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import { createInterfaze } from "../src";

const app = createApp({ apiKey: "test-key", engine: echoEngine });
const interfaze = createInterfaze({
  apiKey: "test-key",
  baseURL: "http://localhost/v1",
  fetch: async (input, init) => app.fetch(new Request(input, init)),
});

describe("Interfaze AI SDK provider", () => {
  it("generates text", async () => {
    const { text, usage } = await generateText({
      model: interfaze("interfaze-beta"),
      prompt: "hello there",
    });
    expect(text).toBe("Echo: hello there");
    expect(usage.outputTokens).toBe(3);
  });

  it("streams text", async () => {
    const result = streamText({ model: interfaze("interfaze-beta"), prompt: "one two three" });
    let text = "";
    for await (const delta of result.textStream) text += delta;
    expect(text).toBe("Echo: one two three");
  });

  it("embeds values", async () => {
    const { embeddings } = await embedMany({
      model: interfaze.embeddingModel("interfaze-embed"),
      values: ["a", "b"],
    });
    expect(embeddings).toHaveLength(2);
  });

  it("surfaces auth failures", async () => {
    const bad = createInterfaze({
      apiKey: "wrong",
      baseURL: "http://localhost/v1",
      fetch: async (input, init) => app.fetch(new Request(input, init)),
    });
    await expect(
      generateText({ model: bad("interfaze-beta"), prompt: "x", maxRetries: 0 }),
    ).rejects.toThrow(/Invalid API key/);
  });
});
