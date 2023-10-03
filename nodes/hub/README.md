# Hub

The Hub is implemented in Node using the Express framework and SQLite database. 

Information for the Hub is held in the `task.hub` object. Only the Hub writes to the `task.hub` object. The Processor communicates with the Hub using the object `task.procesor` which includes fields: command, commandArgs, and config. 

`task.hub.command` maybe be one of:
  * partial
  * update
  * start
  * init
  * error
  * register
  * pong

The Hub provides the following features:
* Task flows (i.e., task configurations) are stored
* The Hub maintains Processor information in the `task.node` object
  * This is simplified when communicating with a specific node by replacing `task.node` with `task.nodes[nodeId]`
    * This could allow for Processor specific `task.nodes[nodeId].config`
* Processors register with the Hub
  * Maintains the list of active nodes
* Processors send `task.command.start` to initiate a Task
  * The Task is then dispatched to the relevant node(s) based on the Task's environment definition
* Synchronization of Tasks across nodes
  * Processors send Task updates to Hub
  * The Hub sends diffential Task updates to all relevant nodes via websocket
    * Supports merging of distributed Task state
    * Supports deletion of object keys (set to null)
    * Supports unchanged array elements (set to null)
* Manage `task.config.oneFamily` - only one instance of the Task per user
  * Additional nodes join rather than start
* Manage `task.config.collaborate` - only one instance of the Task per group
  * Additional nodes join rather than start
* Task interception
  * When a Task sets `task.error` the Hub sends an error Task
* Insertion of user data into Task config template variables
* Insertion of previous Task outputs into Task config template variables
* User/group permissions to access "Start" Tasks are stored/applied
  * The Task tree is built for the available start Tasks (returned with the interface request at the moment)
* The `task.hub.command` "pong" command responds to `task.node.command` "ping" commands
* `task.commandArgs.lock` (and `task.commandArgs.lockBypass`) so updates do not collide
* `task.meta.updateAt` timestamp
* `task.meta.createdAt` timestamp
* `task.meta.parentId` the `task.id` of the Task that started this Task
* `task.meta.updateCount` the number of Task updates completed
* `task.meta.updatesThisMinute` rate of API accesses per minute
* The `update` command sends a diff, not the entire object. The last state of the task received is stored in `task.hub.origTask` which is used to compute the diff before sending to the Processors.
* A mutex imposes serial updates per task instanceId
* Assertion if `task.request` and `task.response` both contain values
* Assertion if `task.state.current` is not listed in `task.state.legal`
* Only route task to node if `task.node.statesSupported` is not set or includes `task.state.current`. If `task.node.statesSupported` is set then the Hub sends the entire Task object not a diff (or it needs to track the current storage of the target node).
* Only route task to node if `task.node.statesNotSupported` is not set or does not include `task.state.current`. If `task.node.statesNotSupported` is set then the Hub sends the entire Task object not a diff (or it needs to track the current storage of the target node).

When the Hub receives an `update` command it will send the update back to the source Processor. This provides the source Processor with task meta information (e.g. lock acquired). By using the broadcasted update the source Processor is synchronized with all other Processors.

# Launch

To install the node packages: `npm install` 

Then to run: `npm start`

# Future
* Hierarchy
  * Many Hubs that can be coordinated by a Hub.
    * Add task.hubs[hubId] (Processor should only see task.hub)
  * Environments not supported by Processors registered with the Hub are passed up to a hub-of-hubs
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
    * Error handling
  * Templating filling
    * Storage
  * Filter execution
    * Event generation (Task updates)
    * Complex event processing (CEP)
  * Scheduling
  * Diff generation
  * Dispatch
  * Privacy masking
* Aspects that are orthogonal to the pipeline (potentially Tasks)
  * Monitoring
  * Logging
  * Debug
  * Upgrading
  * Testing
  * Disaster recovery
  * Security
  * Documentation


