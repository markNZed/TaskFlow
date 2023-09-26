# NodeJS Processor

This is the NodeJS Processor in T@skFlow

1. Written in Node JS run-time, Express framework
3. LLM responses powered by OpenAi API's
4. Fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start` 

Can set the port for the websocket server with environment variable WS_PORT (defaults to 5000)

The best solution to storing Task Data may be a MongoDB server, so in theory any Task on any Processor can acces the same data. Exposing this raises issues such as security so for now we are using SQLite as a key-value store for this (taskDataStore_async). Therfore the Task Functions assume permanent storage is only available on the local processor.

The Processor sends an update/sync request via websocket and does not update the local Task storage until it receives the update via websocket, this helps keep the Processors and Hub storages in sync.