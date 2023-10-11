import asyncio
import signal
import logging
import sys
import os

# Get the module name argument from the command line arguments
module_name = sys.argv[1] if len(sys.argv) > 1 else 'publish'

# Import the specified module dynamically using importlib
import importlib
publish_module = importlib.import_module(module_name)

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

async def watch_parent():
    initial_ppid = os.getppid()
    while True:
        if os.getppid() != initial_ppid:
            logging.info("Parent process has died, exiting...")
            # Use the shutdown function as the cleanup logic
            await shutdown(signal.SIGTERM, loop)
            # Exit the program
            sys.exit(1)
        await asyncio.sleep(30)

async def shutdown(signal, loop):
    logging.info("Received exit signal %s...", signal.name)
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    [task.cancel() for task in tasks]
    await asyncio.gather(*tasks, return_exceptions=True)
    loop.stop()

def handle_exit(loop):
    for s in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(s, lambda s=s: asyncio.create_task(shutdown(s, loop)))

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.create_task(watch_parent())
    handle_exit(loop)
    loop.run_until_complete(publish_module.main())
