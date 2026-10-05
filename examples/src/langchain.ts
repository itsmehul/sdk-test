import { ChatRightPeople, RightPeopleEmbeddings } from "@rightpeople/langchain";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatRightPeople({ model: "rightpeople-beta" });
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  ["user", "{question}"],
]);

const reply = await prompt.pipe(model).invoke({ question: "Hello from LangChain" });
console.log("invoke:", reply.content);

process.stdout.write("stream: ");
for await (const chunk of await model.stream("Streaming via LangChain")) {
  process.stdout.write(String(chunk.content));
}
process.stdout.write("\n");

const vector = await new RightPeopleEmbeddings().embedQuery("hello");
console.log("embedQuery dimensions:", vector.length);
