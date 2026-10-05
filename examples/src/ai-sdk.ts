import { rightpeople } from "@rightpeople/ai-sdk-provider";
import { embed, generateText, streamText } from "ai";

const { text, usage } = await generateText({
  model: rightpeople("rightpeople-beta"),
  prompt: "Hello from the Vercel AI SDK",
});
console.log("generateText:", text, usage);

const result = streamText({ model: rightpeople("rightpeople-beta"), prompt: "Streaming via AI SDK" });
process.stdout.write("streamText: ");
for await (const delta of result.textStream) process.stdout.write(delta);
process.stdout.write("\n");

const { embedding } = await embed({
  model: rightpeople.embeddingModel("rightpeople-embed"),
  value: "hello",
});
console.log("embed dimensions:", embedding.length);
