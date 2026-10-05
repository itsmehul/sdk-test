import { createApp, echoEngine } from "@interfaze/api";
import { describe, expect, it } from "vitest";
import { ChatInterfaze, InterfazeEmbeddings } from "../src";

const app = createApp({ apiKey: "test-key", engine: echoEngine });
const connection = {
  apiKey: "test-key",
  baseURL: "http://localhost/v1",
  configuration: {
    fetch: async (input: string | URL | Request, init?: RequestInit) =>
      app.fetch(new Request(input, init)),
  },
};

describe("ChatInterfaze", () => {
  it("invokes", async () => {
    const model = new ChatInterfaze(connection);
    const reply = await model.invoke("hi langchain");
    expect(reply.content).toBe("Echo: hi langchain");
    expect(reply.usage_metadata?.output_tokens).toBe(3);
  });

  it("streams", async () => {
    const model = new ChatInterfaze(connection);
    let text = "";
    for await (const chunk of await model.stream("token by token")) text += chunk.content;
    expect(text).toBe("Echo: token by token");
  });

  it("reports itself as interfaze", () => {
    const model = new ChatInterfaze(connection);
    expect(model._llmType()).toBe("interfaze");
    expect(ChatInterfaze.lc_name()).toBe("ChatInterfaze");
  });

  it("requires an API key", () => {
    const previous = process.env.INTERFAZE_API_KEY;
    delete process.env.INTERFAZE_API_KEY;
    expect(() => new ChatInterfaze({ baseURL: "http://localhost/v1" })).toThrow(/API key/);
    if (previous !== undefined) process.env.INTERFAZE_API_KEY = previous;
  });
});

describe("InterfazeEmbeddings", () => {
  it("embeds documents and queries", async () => {
    const embeddings = new InterfazeEmbeddings({ ...connection, dimensions: 16 });
    const docs = await embeddings.embedDocuments(["a", "b", "c"]);
    expect(docs).toHaveLength(3);
    expect(docs[0]).toHaveLength(16);
    const query = await embeddings.embedQuery("a");
    expect(query).toEqual(docs[0]);
  });
});
