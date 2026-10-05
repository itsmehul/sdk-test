from langchain_core.prompts import ChatPromptTemplate
from langchain_interfaze import ChatInterfaze, InterfazeEmbeddings

model = ChatInterfaze(model="interfaze-beta")
prompt = ChatPromptTemplate.from_messages(
    [("system", "You are a helpful assistant."), ("user", "{question}")]
)

reply = (prompt | model).invoke({"question": "Hello from LangChain Python"})
print("invoke:", reply.content)

print("stream: ", end="")
for chunk in model.stream("Streaming via LangChain Python"):
    print(chunk.content, end="", flush=True)
print()

vector = InterfazeEmbeddings().embed_query("hello")
print("embed_query dimensions:", len(vector))
