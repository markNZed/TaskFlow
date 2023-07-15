# RxJS Task Processor

This is the RxJS Task Processor in T@skFlow

1. Written in Node JS, Express, RxJS
2. Fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start` 

Can set the port for the websocket server with environment variable WS_PORT (defaults to 5002)

The best solution to storing Task Data may be a MongoDB server, so in theory any Task on any Processor can acces the same data. Exposing this raises issues such as security so for now we are using SQLite as a key-value store for this (taskDataStore_async). Therfore the Task Functions assume permanent storage is only available on the local processor.  