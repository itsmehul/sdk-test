import { createApp, echoEngine } from "@rightpeople/api";
import { describe, expect, it } from "vitest";
import { ChatRightPeople, RightPeopleEmbeddings } from "../src";

const app = createApp({ apiKey: "test-key", engine: echoEngine });
const connection = {
  apiKey: "test-key",
  baseURL: "http://localhost/v1",
  configuration: {
    fetch: async (input: string | URL | Request, init?: RequestInit) =>
      app.fetch(new Request(input, init)),
  },
};

describe("ChatRightPeople", () => {
  it("invokes", async () => {
    const model = new ChatRightPeople(connection);
    const reply = await model.invoke("hi langchain");
    expect(reply.content).toBe("Echo: hi langchain");
    expect(reply.usage_metadata?.output_tokens).toBe(3);
  });

  it("streams", async () => {
    const model = new ChatRightPeople(connection);
    let text = "";
    for await (const chunk of await model.stream("token by token")) text += chunk.content;
    expect(text).toBe("Echo: token by token");
  });

  it("reports itself as rightpeople", () => {
    const model = new ChatRightPeople(connection);
    expect(model._llmType()).toBe("rightpeople");
    expect(ChatRightPeople.lc_name()).toBe("ChatRightPeople");
  });

  it("requires an API key", () => {
    const previous = process.env.RIGHTPEOPLE_API_KEY;
    delete process.env.RIGHTPEOPLE_API_KEY;
    expect(() => new ChatRightPeople({ baseURL: "http://localhost/v1" })).toThrow(/API key/);
    if (previous !== undefined) process.env.RIGHTPEOPLE_API_KEY = previous;
  });
});

describe("RightPeopleEmbeddings", () => {
  it("embeds documents and queries", async () => {
    const embeddings = new RightPeopleEmbeddings({ ...connection, dimensions: 16 });
    const docs = await embeddings.embedDocuments(["a", "b", "c"]);
    expect(docs).toHaveLength(3);
    expect(docs[0]).toHaveLength(16);
    const query = await embeddings.embedQuery("a");
    expect(query).toEqual(docs[0]);
  });
});
