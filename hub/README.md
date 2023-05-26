# Task Hub

The Task Hub is implemented in node using the Express framework and SQLite database. It provides the following features:
* Processors register with the Hub via HTTP request
* Processors initiate a session via HTTP request
* Processors send a request to the Hub start route to initiate
* Synchronization of Tasks across processors
  * Processors send updates to Hub with an HTTP request
  * Hub sends updates to all relevant processors via websocket
    * When a Task is done the Hub sends the nextTask
    * When a Task contains an error the Hub sends an error Task
# Start
This is the Task Hub T@skFlow
1. written in Node JS run-time, Express framework
2. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start`

# Future
The Task Hub should allow for stacking i.e., many Task Hubs that can be coordinated by a Task Hub. Maybe the Task Hub does not need to know if it is communicating with a Task Hub or Task Processor.
