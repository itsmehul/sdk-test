import asyncio

from rightpeople import AsyncRightPeople, RightPeople, RateLimitError

client = RightPeople()

models = client.models.list()
print("Models:", ", ".join(m.id for m in models.data))

try:
    completion = client.chat.completions.create(
        model="rightpeople-beta",
        messages=[{"role": "user", "content": "Hello from the Python SDK"}],
        timeout=10,
    )
    print("Completion:", completion.choices[0].message.content)
except RateLimitError as error:
    print(f"Retry after {error.retry_after}s")
    raise

with client.chat.completions.create(
    model="rightpeople-beta",
    messages=[{"role": "user", "content": "Stream this sentence back to me"}],
    stream=True,
) as stream:
    print("Stream: ", end="")
    for chunk in stream:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
    print()

embedding = client.embeddings.create(model="rightpeople-embed", input="hello")
print("Embedding dimensions:", len(embedding.data[0].embedding))


async def main() -> None:
    async with AsyncRightPeople() as async_client:
        reply = await async_client.chat.completions.create(
            model="rightpeople-beta", messages=[{"role": "user", "content": "Hello async"}]
        )
        print("Async:", reply.choices[0].message.content)


asyncio.run(main())
