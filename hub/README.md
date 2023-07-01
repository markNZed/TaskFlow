# Task Hub

The Task Hub is implemented in Node using the Express framework and SQLite database. 

Information for the hub is held in the `task.hub` object. Only the Task Hub writes to the `task.hub` object. The Task Processor communicates with the Task Hub using the object `task.procesor` which includes fields: command, commandArgs, and config. 

`task.hub.command` maybe be one of:
  * partial
  * update
  * start
  * next
  * register
  * pong

The Hub provides the following features:
* Task flows (i.e., task configurations) are stored
* The Hub maintains Processor information in the `task.processor` object
  * This is simplified when communicating with a specific processor by replacing `task.processor` with `task.processor[processorId]`
    * This could allow for Processor specific `task.processor[processorId].config`
* Processors register with the Hub via HTTP request
  * Maintains the list of active processors
* Processors send `task.command.start` to initiate a Task
  * The Task is then dispatched to the relevant processor(s) based on the Task's environment definition
* Synchronization of Tasks across processors
  * Processors send Task updates to Hub via HTTP
  * The Hub sends diffential Task updates to all relevant processors via websocket
    * Supports merging of distributed Task state
    * Supports deletion of object keys (set to null)
    * Supports unchanged array elements (set to null)
* Manage `task.config.oneFamily` - only one instance of the Task per user
  * Additional processors join rather than start
* Manage `task.config.collaborate` - only one instance of the Task per group
  * Additional processors join rather than start
* Task interception
  * When a Task sets `task.done` to `true` the Hub sends the next Task(s)
  * When a Task sets `task.error` the Hub sends an error Task
* Insertion of user data into Task config template variables
* Insertion of previous Task outputs into Task config template variables
* User/group permissions to access "Start" Tasks are stored/applied
  * The Task tree is built for the available start Tasks (returned with the interface request at the moment)
* The `task.hub.command` "pong" command responds to `task.processor.command` "ping" commands
* `task.commandArgs.lock` (and `task.commandArgs.lockBypass`) so updates do not collide
* `task.meta.updateAt` timestamp
* `task.meta.createdAt` timestamp
* `task.meta.parentId` the `task.id` of the Task that started this Task
* `task.meta.updateCount` the number of Task updates completed
* `task.meta.updatesThisMinute` rate of API accesses per minute

# Launch

To install the node packages: `npm install` 

Then to run: `npm start`

# Future
* Hierarchy
  * Many Task Hubs that can be coordinated by a Task Hub.
    * Add task.hubs[hubId] (Processor should only see task.hub)
  * Task Environments not supported by Processors registered with the Hub are passed up to a hub-of-hubs
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


