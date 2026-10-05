import { Interfaze, RateLimitError } from "@interfaze/sdk";

const client = new Interfaze();

const models = await client.models.list();
console.log("Models:", models.data.map((m) => m.id).join(", "));

try {
  const completion = await client.chat.completions.create(
    {
      model: "interfaze-beta",
      messages: [{ role: "user", content: "Hello from @interfaze/sdk" }],
    },
    { signal: AbortSignal.timeout(10_000) },
  );
  console.log("Completion:", completion.choices[0]?.message.content);
} catch (error) {
  if (error instanceof RateLimitError) console.error(`Retry after ${error.retryAfter}s`);
  throw error;
}

const stream = await client.chat.completions.create({
  model: "interfaze-beta",
  messages: [{ role: "user", content: "Stream this sentence back to me" }],
  stream: true,
});
process.stdout.write("Stream: ");
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta.content ?? "");
process.stdout.write("\n");

const { data } = await client.embeddings.create({ model: "interfaze-embed", input: "hello" });
console.log("Embedding dimensions:", data[0]?.embedding.length);
