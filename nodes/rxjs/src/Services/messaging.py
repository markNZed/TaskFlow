import asyncio
import redis.asyncio as redis_async
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

    async def _connect_redis(self):
        return await redis_async.Redis.from_url(self.redis_url)

    async def connect(self):
        if not self.subscriber:
            self.subscriber = await self._connect_redis()
        if not self.publisher:
            self.publisher = await self._connect_redis()

    async def disconnect(self):
        if self.subscriber:
            await self.subscriber.aclose()
            self.subscriber = None
        if self.publisher:
            await self.publisher.aclose()
            self.publisher = None

    async def subscribe(self, channel):
        if not self.subscriber:
            await self.connect()
        
        self.subscribe_channel = channel
        pubsub = self.subscriber.pubsub()
        await pubsub.subscribe(self.subscribe_channel)
        return pubsub

    async def publish(self, message, channel=None):
        if not channel:
            if not self.publish_channel:
                raise ValueError("No channel specified to publish the message.")
            channel = self.publish_channel
            
        if not self.publisher:
            await self.connect()

        try:
            await self.publisher.publish(channel, message)
        except redis_async.ConnectionError:
            logging.error("Lost connection to Redis. Attempting to reconnect...")
            await self.connect()
            await self.publisher.publish(channel, message)

    async def listen(self, pubsub):
        #print("[DEBUG] Starting listen method.")
        if not self.subscriber:
            print("[DEBUG] Subscriber not connected. Attempting to connect.")
            await self.connect()
        else:
            print("[DEBUG] Subscriber already connected.")
        async for message in pubsub.listen():
            #print(f"[DEBUG] Received raw message: {message}")
            data = message.get("data", None)
            if data and isinstance(data, bytes):
                decoded_data = data.decode()
                print(f"[DEBUG] Decoded message data: {decoded_data}")
                
                if decoded_data == self.STOPWORD:
                    print(f"[DEBUG] Detected STOPWORD '{self.STOPWORD}'. Exiting listen.")
                    return  # instead of break
                yield decoded_data
            else:
                print("[DEBUG] Message data is not bytes. Ignoring.")


    async def enqueue(self, queue, message):
        if not self.publisher:
            await self.connect()
            
        await self.publisher.lpush(queue, message)

    async def dequeue(self, queue, timeout=0):
        if not self.subscriber:
            await self.connect()
            
        _, message = await self.subscriber.brpop(queue, timeout)
        if message:
            return message.decode()
        return None
