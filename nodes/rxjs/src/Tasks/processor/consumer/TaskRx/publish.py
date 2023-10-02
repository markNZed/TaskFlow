import asyncio
import async_timeout
import aioredis
import logging
import signal

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

STOPWORD = "STOP"

async def shutdown(signal, loop):
    print(f"Received exit signal {signal.name}...")
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]

    [task.cancel() for task in tasks]

    await asyncio.gather(*tasks, return_exceptions=True)
    loop.stop()

def handle_exit(loop):
    for s in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(s, lambda s=s: asyncio.create_task(shutdown(s, loop)))

async def listen_to_redis(channel: aioredis.client.PubSub):
    while True:
        try:
            async with async_timeout.timeout(1):
                message = await channel.get_message(ignore_subscribe_messages=True)
                if message is not None:
                    logging.info("(Reader) Message Received: %s", message)
                    if message["data"].decode() == STOPWORD:
                        logging.info("(Reader) %s", STOPWORD)
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

async def main():
    redis = psub = None
    
    try:
        redis = aioredis.from_url("redis://redis-stack-svc")
        psub = redis.pubsub()
        await psub.subscribe('channel_from_js')
        
        future = asyncio.create_task(listen_to_redis(psub))
        pub = aioredis.from_url("redis://redis-stack-svc")
        
        await pub.publish("channel_from_py", "Hello")
        await pub.publish("channel_from_py", "World")
        await pub.publish("channel_from_py", "from Py!")
        await future
        
    except aioredis.RedisError as e:
        print(f"Redis error: {str(e)}")
        
    finally:
        # Ensuring resources are cleaned up
        if psub is not None:
            await psub.unsubscribe('channel_from_js')
            await psub.close()
        if redis is not None:
            redis.close()
        if pub is not None:
            pub.close()

if __name__ == "__main__":
    asyncio.run(main())
