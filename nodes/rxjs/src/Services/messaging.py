import asyncio
import aioredis
import async_timeout
import logging

logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

class MessagingClient:
    STOPWORD = "STOP"

    def __init__(self, subscribe_channel=None, publish_channel=None, redis_url="redis://redis-stack-svc"):
        self.subscribe_channel = subscribe_channel
        self.publish_channel = publish_channel
        self.redis_url = redis_url
        self.subscriber = None
        self.publisher = None

    async def connect(self):
        self.subscriber = aioredis.from_url(self.redis_url)
        self.publisher = aioredis.from_url(self.redis_url)

    async def disconnect(self):
        if self.subscriber is not None:
            self.subscriber.close()
        if self.publisher is not None:
            self.publisher.close()

    async def subscribe(self, channel):
        self.subscribe_channel = channel
        psub = self.subscriber.pubsub()
        await psub.subscribe(self.subscribe_channel)
        return psub

    async def publish(self, message, channel=None):
        if channel is None:
            channel = self.publish_channel
        await self.publisher.publish(channel, message)

    async def listen(self, channel):
        while True:
            try:
                async with async_timeout.timeout(1):
                    message = await channel.get_message(ignore_subscribe_messages=True)
                    if message is not None:
                        logging.info(f"(Reader) Message Received: {message}")
                        if message["data"].decode() == self.STOPWORD:
                            logging.info("(Reader) STOP")
                            break
                    await asyncio.sleep(0.01)
            except asyncio.TimeoutError:
                logging.warning("No message received in the last second, continuing...")
            except UnicodeDecodeError:
                logging.error("Error decoding message, potentially non-UTF-8 data received.")
            except asyncio.CancelledError:
                logging.info("Listen task was cancelled. Cleaning up and exiting...")
                break
            except aioredis.RedisError as e:
                logging.error(f"Redis error while listening: {str(e)}")
            except Exception as e:
                logging.error(f"Unexpected error: {str(e)}")
