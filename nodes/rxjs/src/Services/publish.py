import asyncio
from messaging import MessagingClient

async def process_messages(client, psub):
    async for message in client.listen(psub):
        # Handle each message here
        print(message)

async def main():
    messaging_client = MessagingClient()
    await messaging_client.connect()
    
    try:
        pub_channel = "channel_from_py"
        sub_channel = "channel_from_js"
        psub = await messaging_client.subscribe(sub_channel)
        
        listen_task = asyncio.create_task(process_messages(messaging_client, psub))
        await messaging_client.publish("Hello", pub_channel)
        await messaging_client.publish("World", pub_channel)
        await messaging_client.publish("from Py!", pub_channel)
        await listen_task
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        await messaging_client.disconnect()

# Run the main function
asyncio.run(main())

