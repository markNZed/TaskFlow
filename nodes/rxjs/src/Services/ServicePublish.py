import asyncio
import signal
import logging
from messaging import MessagingClient

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

async def shutdown(signal, loop):
    logging.info("Received exit signal %s...", signal.name)
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    [task.cancel() for task in tasks]
    await asyncio.gather(*tasks, return_exceptions=True)
    loop.stop()

def handle_exit(loop):
    for s in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(s, lambda s=s: asyncio.create_task(shutdown(s, loop)))

async def main():
    messaging_client = MessagingClient()
    await messaging_client.connect()
    
    try:
        pub_channel = "channel_from_py"
        sub_channel = "channel_from_js"
        psub = await messaging_client.subscribe(sub_channel)
        
        listen_task = asyncio.create_task(messaging_client.listen(psub))
        await messaging_client.publish("Hello", pub_channel)
        await messaging_client.publish("World", pub_channel)
        await messaging_client.publish("from Py!", pub_channel)
        await listen_task
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        await messaging_client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())