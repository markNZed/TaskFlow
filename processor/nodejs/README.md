# NodeJS Task Processor

This is the NodeJS Task Processor side of T@skFlow
1. written in Node JS run-time, Express framework
3. LLM responses powered by OpenAi API's
4. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start` 

We can set the port for the websocket server with environment variable WS_PORT (defaults to 5000)

The ultimate solution to storing Task Data may be a MongoDB server, so in theory any Task on any Processor can acces the same data. Exposing this raises security issues etc so for now we are using SQLite as a key-value store for this (taskDataStore_async), so the Task Functions assume permanent storage is only available on the Node JS processor.  