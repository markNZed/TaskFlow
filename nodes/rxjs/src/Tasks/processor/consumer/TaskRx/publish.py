import asyncio
import async_timeout
import aioredis

STOPWORD = "STOP"

async def listen_to_redis(channel: aioredis.client.PubSub):
    while True:
        try:
            async with async_timeout.timeout(1):
                message = await channel.get_message(ignore_subscribe_messages=True)
                if message is not None:
                    print(f"(Reader) Message Received: {message}")
                    if message["data"].decode() == STOPWORD:
                        print("(Reader) STOP")
                        break
                await asyncio.sleep(0.01)
        except asyncio.TimeoutError:
            pass


async def main():
    redis = aioredis.from_url("redis://redis-stack-svc")
    psub = redis.pubsub()
    await psub.subscribe('channel_from_js')

    future = asyncio.create_task(listen_to_redis(psub))

    pub = aioredis.from_url("redis://redis-stack-svc")

    await pub.publish("channel_from_py", "Hello")
    await pub.publish("channel_from_py", "World")
    await pub.publish("channel_from_py", "from Py!")

    await future

if __name__ == "__main__":
    asyncio.run(main())
