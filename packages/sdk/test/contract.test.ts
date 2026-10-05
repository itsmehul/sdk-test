import { createApp, echoEngine } from "@rightpeople/api";
import { describe, expect, it } from "vitest";
import { AuthenticationError, BadRequestError, RightPeople, NotFoundError } from "../src";

const app = createApp({ apiKey: "test-key", engine: echoEngine });
const client = new RightPeople({
  apiKey: "test-key",
  baseURL: "http://localhost/v1",
  fetch: (request) => app.fetch(request),
});

describe("contract against the reference API", () => {
  it("lists and retrieves models", async () => {
    const list = await client.models.list();
    expect(list.object).toBe("list");
    expect(list.data.map((m) => m.id)).toContain("rightpeople-beta");

    const model = await client.models.retrieve("rightpeople-beta");
    expect(model).toMatchObject({ id: "rightpeople-beta", object: "model" });
  });

  it("maps 404 to NotFoundError with request id", async () => {
    const error = await client.models.retrieve("nope").catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.status).toBe(404);
    expect(error.code).toBe("model_not_found");
    expect(error.requestId).toBeTruthy();
  });

  it("maps 401 to AuthenticationError", async () => {
    const bad = new RightPeople({
      apiKey: "wrong",
      baseURL: "http://localhost/v1",
      fetch: (request) => app.fetch(request),
    });
    await expect(bad.models.list()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("maps validation failures to BadRequestError", async () => {
    const error = await client.chat.completions
      .create({ model: "rightpeople-beta", messages: [] })
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.param).toBe("messages");
  });

  it("creates a chat completion", async () => {
    const completion = await client.chat.completions.create({
      model: "rightpeople-beta",
      messages: [{ role: "user", content: "hello world" }],
    });
    expect(completion.choices[0]?.message.content).toBe("Echo: hello world");
    expect(completion.usage.total_tokens).toBeGreaterThan(0);
  });

  it("streams a chat completion", async () => {
    const stream = await client.chat.completions.create({
      model: "rightpeople-beta",
      messages: [{ role: "user", content: "stream me please" }],
      stream: true,
      stream_options: { include_usage: true },
    });

    let text = "";
    let usage: unknown;
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta.content ?? "";
      if (chunk.usage) usage = chunk.usage;
    }
    expect(text).toBe("Echo: stream me please");
    expect(usage).toMatchObject({ completion_tokens: 4 });
  });

  it("creates embeddings", async () => {
    const res = await client.embeddings.create({
      model: "rightpeople-embed",
      input: ["a", "b"],
      dimensions: 8,
    });
    expect(res.data).toHaveLength(2);
    expect(res.data[0]?.embedding).toHaveLength(8);
  });
});
