import asyncio
import time
from messaging import MessagingClient
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.summarizers.lex_rank import LexRankSummarizer
from sumy.summarizers.luhn import LuhnSummarizer
from sumy.summarizers.edmundson import EdmundsonSummarizer
from sumy.summarizers.kl import KLSummarizer
import redis.asyncio as redis_async

pub_channel = "channel_from_py"

async def listen_messages(messaging_client, psub):
    print("Sending READY")
    await messaging_client.publish("READY", pub_channel)
    async for message in messaging_client.listen(psub):
        # Parse the received text
        await messaging_client.publish(f"Received message of size {len(message)} bytes.", pub_channel)
        print(f"Received message of size {len(message)} bytes. Parsing.")
        parser = PlaintextParser.from_string(message, Tokenizer("english"))
        
        summarizers = {
            "LsaSummarizer": LsaSummarizer,
            #"LexRankSummarizer": LexRankSummarizer,
            #"LuhnSummarizer": LuhnSummarizer,
            #"EdmundsonSummarizer": EdmundsonSummarizer, # Needs bonus words
            #"KLSummarizer": KLSummarizer # Hangs
        }
        
        for summarizer_name, Summarizer in summarizers.items():
            print(f"----------------------------")
            print(f"Using the {summarizer_name}.")
            await messaging_client.publish(f"Using the {summarizer_name}.", "channel_from_py")
            
            start_time = time.time()  # Start time before summarization
            summarizer = Summarizer()
            summary = summarizer(parser.document, 3)  # Summarize to 3 sentences
            end_time = time.time()  # End time after summarization

            elapsed_time = end_time - start_time  # Calculate time taken
            print(f"{summarizer_name} took {elapsed_time:.4f} seconds.")
            await messaging_client.publish(f"{summarizer_name} took {elapsed_time:.4f} seconds.", "channel_from_py")
            
            # Send the summary
            for sentence in summary:
                await messaging_client.publish(str(sentence), "channel_from_py")

async def send_sample_messages(messaging_client):
    print(f"Sending Hello World")
    await messaging_client.publish("Hello World from Py!", pub_channel)

async def main():
    messaging_client = MessagingClient()
    await messaging_client.connect()
    
    try:
        sub_channel = "channel_from_js"
        psub = await messaging_client.subscribe(sub_channel) 
        
        # Running listening and sending sample messages in parallel
        listen_task = asyncio.create_task(listen_messages(messaging_client, psub))
        other_task = asyncio.create_task(send_sample_messages(messaging_client))
        
        await asyncio.gather(listen_task, other_task)

    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        await messaging_client.disconnect()

# Run the main function
asyncio.run(main())


""" 
async def direct_listen():
    client = await redis_async.Redis.from_url("redis://redis-stack-svc")
    pubsub = client.pubsub()
    await pubsub.subscribe("channel_from_js")

    async for message in pubsub.listen():
        print(message)

asyncio.run(direct_listen()) """

