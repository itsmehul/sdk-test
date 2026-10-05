from langchain_core.prompts import ChatPromptTemplate
from langchain_rightpeople import ChatRightPeople, RightPeopleEmbeddings

model = ChatRightPeople(model="rightpeople-beta")
prompt = ChatPromptTemplate.from_messages(
    [("system", "You are a helpful assistant."), ("user", "{question}")]
)

reply = (prompt | model).invoke({"question": "Hello from LangChain Python"})
print("invoke:", reply.content)

print("stream: ", end="")
for chunk in model.stream("Streaming via LangChain Python"):
    print(chunk.content, end="", flush=True)
print()

vector = RightPeopleEmbeddings().embed_query("hello")
print("embed_query dimensions:", len(vector))
