# Task Hub

The Task Hub is implemented in node using the Express framework and SQLite database. 

Information for the hub is held in the task.hub object.

The Hub provides the following features:
* Task flows (i.e., task configurations) are stored
* The Hub maintains Processor information in the task.processor object
  * This is simplified when communicating with a specific processor by replacing task.processor with task.processor[processorId]
* Processors register with the Hub via HTTP request
  * Maintain the list of active processors
* Processors can initiate a sessionId via HTTP request
* Processors send an HTTP request to the Hub's "start" route to initiate a Task sequence
  * The relevant processor(s) are selected based on the Task's environment definition
* Synchronization of Tasks across processors
  * Processors send Task updates to Hub via HTTP request
  * The Hub sends diffential Task updates to all relevant processors via websocket
    * Supports merging of distributed Task state
    * Supports deletion of object keys (set to null)
    * Supports unchanged array elements (set to null)
* Manage oneThread configuration (only one instance of the Task per user)
  * Additional processors join rather than start
* manage collaborate configuration (only one instance of the Task per group)
  * Additional processors join rather than start
* Task interception
  * When a Task is done the Hub sends the next Task(s)
  * When a Task contains an error the Hub sends an error Task
* Insertion of user data into Task config template variables
* Insertion of previous Task outputs into Task config template variables
* User/group permissions to access "Start" Tasks are stored/applied
  * The Task tree is built for the available start Tasks (returned with the sessionId request at the moment)
* Pong command responses to Processor ping commands
* Error management
* task.lock (and task.lockBypass) so updates do not collide
* task.meta.updateAt timestamp
# Start
This is the Task Hub T@skFlow
1. written in Node JS run-time, Express framework
2. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start`

# Future
* Hierarchy
  * Many Task Hubs that can be coordinated by a Task Hub.
    * Extend task.hub to task.hub[hubId] (Processor should still see task.hub)
  * Task functions not supported by Processors in the Hub's processors are passed up
* Security/Privacy
  * Filtering of Task content
* Separation of concerns into a pipeline
  * Versioning
  * Authentication
  * Throttling
  * Authorization
  * Storage
  * Task locking
  * Task interception
    * Next Task selection
    * Error handling
  * Templating filling
    * Storage
  * Filter execution
    * Event generation (Task updates)
    * Complex event processing (CEP)
  * Scheduling
  * Diff generation
  * Dispatch
  * Privacy filtering
* Aspects that are orthogonal to the pipeline
  * Monitoring
  * Logging
  * Debug
  * Upgrading
  * Testing
  * Disaster recovery
  * Security
  * Documentation


