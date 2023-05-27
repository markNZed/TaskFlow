# Task Hub

The Task Hub is implemented in node using the Express framework and SQLite database. It provides the following features:
* Task flows (i.e., task configurations) are stored
* Processors register with the Hub via HTTP request
* Processors initiate a session via HTTP request
* Processors send an HTTP request to the Hub's "start" route to initiate a Task sequence
* Synchronization of Tasks across processors
  * Processors send Task updates to Hub via HTTP request
  * The Hub sends Task updates to all relevant processors via websocket
    * When a Task is done the Hub sends the next Task(s)
    * When a Task contains an error the Hub sends an error Task
    * The relevant processor(s) are selected based on the Task's environment definition
* Insertion of user data into Task config template variables
* Insertion of previous Task outputs into Task config template variables
* User/group permissions to access "Start" Tasks are stored/applied
  * The Task tree is built for the available start Tasks (returned with the sessionId request at the moment)
* Pong command responses to Processor ping commands
* Error management
# Start
This is the Task Hub T@skFlow
1. written in Node JS run-time, Express framework
2. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start`

# Future
The Task Hub should allow for stacking i.e., many Task Hubs that can be coordinated by a Task Hub. Maybe the Task Hub does not need to know if it is communicating with a Task Hub or Task Processor.
