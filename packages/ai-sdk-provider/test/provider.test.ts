import { createApp, echoEngine } from "@rightpeople/api";
import { embedMany, generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import { createRightPeople } from "../src";

const app = createApp({ apiKey: "test-key", engine: echoEngine });
const rightpeople = createRightPeople({
  apiKey: "test-key",
  baseURL: "http://localhost/v1",
  fetch: async (input, init) => app.fetch(new Request(input, init)),
});

describe("RightPeople AI SDK provider", () => {
  it("generates text", async () => {
    const { text, usage } = await generateText({
      model: rightpeople("rightpeople-beta"),
      prompt: "hello there",
    });
    expect(text).toBe("Echo: hello there");
    expect(usage.outputTokens).toBe(3);
  });

  it("streams text", async () => {
    const result = streamText({ model: rightpeople("rightpeople-beta"), prompt: "one two three" });
    let text = "";
    for await (const delta of result.textStream) text += delta;
    expect(text).toBe("Echo: one two three");
  });

  it("embeds values", async () => {
    const { embeddings } = await embedMany({
      model: rightpeople.embeddingModel("rightpeople-embed"),
      values: ["a", "b"],
    });
    expect(embeddings).toHaveLength(2);
  });

  it("surfaces auth failures", async () => {
    const bad = createRightPeople({
      apiKey: "wrong",
      baseURL: "http://localhost/v1",
      fetch: async (input, init) => app.fetch(new Request(input, init)),
    });
    await expect(
      generateText({ model: bad("rightpeople-beta"), prompt: "x", maxRetries: 0 }),
    ).rejects.toThrow(/Invalid API key/);
  });
});
