# RxJS Task Processor

This is the RxJS Task Processor in T@skFlow. RxJS version 7 implements ReactiveX which is language-agnostic, and there are many implementations of the ReactiveX API in various programming languages, including RxJava, RxSwift, and others.

1. Written in Node JS, Express, RxJS
2. Fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start` 

Can set the port for the websocket server with environment variable WS_PORT (defaults to 5002)

This Task Processor can function as a Task Hub CoProcessor or as a Task Processor. Id the .env variable COPROCESSOR is 'true' then the TASK_DIR will default to `src/TaskCoprocessor` rather than `src/Task`. 
