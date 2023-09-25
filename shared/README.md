# Shared

# Config

The `config.mjs` file is shared by Task hub and Task Processors (loaded into their local config.mjs). This should actually load the variables from a JSON file. It provides:
* appLabel
* appName
* appAbbrev
* REDIS_URL
* MONGO_URL
* EMPTY_ALL_DB - when true then all DBs are emptied on restart

# Task Definition Schema

The schema is defined in JSON and [Quicktype](https://quicktype.io) is used to generate validation code.

The Task schema defines a staic object (i.e. no funtions) so it is language independant. Therfore conventions are criticla to allowing for communication and synchronization. The conventions must be enforced by the Task Processors and Task Hub. 

The task.input should not be driven by the Task, this ensure that it will not overwrite values.
The task.meta should not be modified by the Task.
Each parameter in task.output should be updated by a single processor or managed carefully (e.g., locking) to avoid conflicts.
task.request should be used for sending information within the distributed task
task.response should be used for information within the distributed task in response to task.request
task.state may also be used for internal Task communication and synchronization
The processor that locks a Task should ideally also unlock the Task

task.config stores generic configuration information that many tasks may use, it is inherited by tasks further down the hierarchy.
task.config.local stores tasktype specific configuration information that is not inherited.
task.config.operators stores operator specific configuration information.
task.config.ceps stores CEP specific configuration information

The task.config.ceps object contains: 
  {
    "MATCH_STRING": { // id, instanceId, or familyId
      functionName: "FUNCTION_NAME", // name of the CEP function in the Task Function
      args: {ARG: VALUE} // arguments passed to the CEP function
    }
  }
The CEP function is assumed to provide: FUNCTION_NAME(task, args)

The task.config.cache object allows for flexible cache rules, it is an array of objects (so use APPEND_cache to allow for inheritance):
* cache.enable - boolean, can be excluded and in that case is assumed to be true
* cache.seed - array of strings or paths in the task object e.g. ["task.name"] or ["123"]

The task.config.operators.OperatorNAME.cache controls caching in the Operator
The task.config.operators.OperatorNAME.seed sets the cache seed in the Operator, it is an array of strings or paths in the task object e.g. ["task.name"] or ["123"]

`task.config.services` stores an array of service configurations

`task.id` is referring to the configuration `id`. It is a dot separated path of the parent Tasks (the configuration is inherited). There are two principle categories of tasks: system tasks and user tasks. System Tasks have an id starting with `root.system.` and user tasks have an id starting with `root.user.` 

Tasks can be configured to start automatically with the `task.config` parameters `autoStartEnvironment`, `autoStartOnce`, `autoStartCoProcessor`. An example of this is the TaskCEPSystemLog task type which starts once on the Task Hub Coprocessor.

`task.hash` can be used on the Task Processor to validate the task storage is in sync with the Task Hub. The utility function taskHash applies a hash on a JSON string of a recursivley key ordered partial Task object. This is reproducible in other programming languages by replicating the key ordering method, the JSON string representation, and the hash function. Only the Task Hub generates the hash and only the Task Processors optionally check the hash i.e., a Task Processor could ignore the hash. Because the update and sync send diffs based on local storage the hash can highlight issues that may otherwise be harder to find.

The `task.meta.lock` is not considered for `sync` commands.

Tasks are configured as a Javascript object in in hub/config/tasks.mjs A task can refer to a parent with `parentName` which will search for a task that was previously defined with this name. Note that the same name could be used in different positions of the task hierarchy, in which case the task most recently configured will match. A `meta.childrenIds` array can be used to specify the id of one or more `task.id` and this allows for a task to reuse part of an existing task sequence, for example, TaskTest can be placed above a task to test the behavior of the task without that task configuration mentioning TaskTest.

task.commands:
* start
* init
* update
* partial
* nop
* sync

To be able to insert tasks into a sequence we need to use task.input/output so the inserted task can intercept the data and have its own internal state etc. If a parent makes assumptions about implementation details (e.g. task.state) then the intercepting task is limited by those assumptions. Set user input via task.input so it can be simulated if required. The general rle is that anything we want to be able to control about the task should be visible via task.input and anything we want to know about the task should be visible via task.output

The Task object currently has a fixed set of top level properties. Several properties are objects:
* privacy - a copy of the Task object's structure with boolean types that indicate if the property should be sent from the NodeJS Task Processor to the React Task Processor. For example, this could avoid sending prompts in config data to the web browser.
* input - any object, task inputs (UI inputs should pass through `input`)
* output - any object, generated by the task that is available to other tasks
* config - any object, for configuration
* state - an object that allows the Task Processor to manage the Task state
* request - any object, defines what the recipient of the Task should do
* response - any object, results from a request

Separate the concerns addressed by the Task Definition:
* Versioning
* Authentication
* Authorization
* Task Hub interaction
* Task Routing
* Task Processor interaction
* Task Identity
* Task Metadata
* Task Masking
* Task Relations
* Error handling
* Task Configuration
* IO
* Task State

There is a hierarchy: 
* Versioning
  * Authentication
    * Authorization
      * Task Hub
        * Task Routing
          * Task Processor
            * Task Identity
                * Task Masking
                  * Task Metadata
                    * Task Relations
                  * Error handling
                    * Task Configuration
                    * Task Function
                      * Status
                      * State
                        * Incoming
                          * Request
                          * Response
                        * Outgoing
                          * Request
                          * Response
                        * IO


If a request is made then, typically, the entire Task object is sent. A copy of the Task may be held and it would then be the responsibility of the Task to deal with the Task object being updated when the request is completed. The state can be used to communicate between the Task Processor functionality of a Task.

It would be relatively simple to maintain a copy of the last Task received on the NodeJS Task Processor and a copy of the last Task received on the React Task Processor, then to send only the difference when updating the Task. Anoher option is to use GraphQL.

The infrastructure provided by the Task Processor should perform the updates to the Task object as this allows for services to be provided upon value changes.

Tasks could be simple and composed
  This means there is no need to modify the "internals" of a Task
  It also creates a lot of repeated code in the Task Functions 
  It also means a lot of configuration to construct more complicated tasks from many components
  Supporting both simple and complicated seems possible.

# Task merging

The rules for merging the Task are: there should be no changes to the same entries in the Task object, changes made locally are kept and changes from the updated task are merged (in that order). There should be a check for any conflicts where a value has been set locally and is also set by the updated Task.

## Future
JSON schema provides several keywords to specify rules for relationships, such as allOf, anyOf, oneOf, and not.

Draft-07 introduces conditional schema evaluation using the if, then, and else keywords. They provide a way to apply subschemas conditionally, allowing for more complex validation logic. Draft-07 introduces the propertyNames keyword, which can be used to apply a schema to the names of all properties in an object, allowing for validation of property names.

What additional concerns are address: incoming/outgoing, logging

v03:
* privacy -> propertyMask
* config.label -> label
* change timestamp (completedAt, createdAt, updatedAt) types to Date
* groupId as an array
* Add signature so service could sign a Task
* familyId becomes array
* priority as an integer (0 - 100)
* status as an enum type (pending, in progress, completed, failed)
* error -> errorMessage as string + errorDetails as object
* expireAt as a Date
* resourceRequirement as an object with properties: cpu, memory, disk, network, environment (e.g., browser, python, nodejs etc) 
* dependencies as an array of instanceIds
* resourceConsumed as an object with properties: cpu, memory, disk, network Could also include a signature. Allows for metrics.
* tags as an array of strings
* history an array of transactions made on the Task? Might be a debug aid.
* lang as a language code
* incomingRequest
* response -> incomingResponse
* incomingCount
* request -> outgoingRequest
* outgoingResponse
* outgoingCount
* processor data provided by the Task processor
  * location
  * API a list of API ids consider what langchain does for models
* logHistory as an array of log messages
* log as a string
* permissions -> groupAccess
* error -> an object with type and message and stack (or just a free-form object)
* Task processor timezone
* task.processors[environment] would allow inititialisation of task.processor for a given environment e.g. configuring task.processor.statesSupported
* Could add a check in schema to config.services that type + environments must exist

### Task Processor

Below needs to be updated now that there is a Hub

The Task processor should:
* validate the Task
* In the future:
  * move outgoingResponse to incomingResponse upon receiving a Task
  * move outgoingRequest to incomingRequest upon receiving a Task
* send the Task when send is true
* Monitor the Task for resource overusage
* Provide a function to set Task properties (manage updatedAt)
* Provide a function to get Task properties
* Manage properties:
  * completedAt, createdAt, updatedAt
  * id, instanceId
  * threadId, children
  * parentId, parentInstanceId
  * userId
  * stack, stackPtr
  * updateCount
* Manage future properties:
  * signature, status, dependencies, incomingCount, outgoingCount, history
* Provide a sevice to "start" a new Task
* Manage authentication and authorization
* Manage property privacy
* Rate limit
* Create nextTask involves 
  * Copying: threadId, lang, userId
  * Creating threadId, instanceId
  * Updating: createdAt, parentId, parentInstanceId
* Archiving completed Tasks
  * updating completedAt
* Logging, error handling, debug support (view into Task)
* Timeouts
* Resource allocation
* Metrics
* Access to archived tasks e.g. by threadId

Task Processor functionality
* stopTask
* writeTask
* readTask
* deleteTask
* getTask
* nextTask
* getTaskThread
* forkTask
* archiveTask
* getTaskHistory
* getTaskMetrics
* validateTask
* getTaskSchema


Rather than going through function calls we use the Task object. This allows a task written in one langauge to run on a Task Processor written in anoher language.
* command -> stopTask, writeTask, readTask, deleteTask, getTask, nextTask, getTaskThread, forkTask, archiveTask, getTaskHistory, getTaskMetrics, validateTask, getTaskSchema
* commandAgs -> arguments for command
* commandResult -> result of command
* commandStatus -> status of command: inProgress, completed, failed
* commandLog -> log of commands
The commands could use JSON-RPC format

The Task may use a library to have a function based interface to the Task Processor.

### Task Environment

The task environment is the software stack that the Task requires. For example the React Task Processor requires a web browser with Javascript. This will allow for Task Processors to accept Tasks if they can provide the correct environment. This will make the system more scalable.

## Open Issues
The request/response fields are used to send Task specific information between the NodeJS Task Processor and React Task Processor but the principle could be applied for other services. We need to think about how this should be separated from the Task specific schema e.g., a distinction between internal and external requests. In this way a Task could publish a service and other tasks could make requests (rather than assuming the communication is within a Task). Could have:
* internalRequest
* internalResponse
* externalRequest
* externalResponse
These could be arrays to support multiple requests/responses. Another organization could be:
* incomingRequest
* incomingResponse
* incomingCount
* outgoingRequest
* outgoingResponse
* outgoingCount
Then the infrastructure could look after queuing etc. This might be simpler. A Task that wants to look after multiple request/response could still do this by asynchronously accepting all incoming messages. This seems better.

Incoming request/response should be in task.processor and outgoing request/response should be in task.

The v02 list of top level properties: baseType, children, completedAt, createdAt, error, permissions, groupId, id, initiator, name, nextTasks, nextTask, parentId, parentInstanceId, parentName, send, stack, stackPtr, threadId, type, updateCount, updatedAt, userId, versionExternal, versionInternal, privacy, input, output, config, state, request, response

We can categorize this from different perspectives:
* static vs dynamic
* internal vs external
* timestamps, identifiers, versioning, task structure, task status and error handling, task data and configuration, privacy settings

Privacy is misleading as it is just concerned about masking the properties during communication. Should rename to propertyMask.

Timestamps are indicated with "At" suffix.

There is a generic authorization concern. At the moment we have a userID and a groupId (this could allow for multiple user interaction, organizations). We should probably use a standard for authentication and authorization. Basically userId is authentication and groupId is authorization.

Should T@sk2Flow be managing authentication e.g. signing of the Task or is that the responsibility of the infrastructure? In a distributed system this is a central concern (services should not be able to impersonate ).

Dealing with forking and merging

A job processing system would be a good comparison point

Status: There is no explicit status property indicating the current state of the task (e.g., pending, in progress, completed, failed). While some properties like 'completedAt' and 'error' can provide status-related information, having a dedicated status property can be more useful.

Expiration: A time-to-live (TTL) or expiration property can be useful in job processing systems to ensure tasks are not executed after a certain period or to clean up tasks that have been sitting in the queue for too long.

Could imagine the Task has a resource requirement and services could then compete to run the Task.

Dependencies: The schema does not explicitly handle task dependencies. While properties like 'nextTasks', 'nextTask', and 'parentId' can be used to describe some task relationships, having a dedicated property for dependencies can be beneficial in managing task execution order and handling complex taskflows.

Metrics and monitoring: Properties related to task metrics and monitoring (e.g., duration, start time, end time, and performance indicators) are missing from the schema. These properties can be useful in understanding the efficiency and effectiveness of the job processing system.
## Generating

It is possible to have node generate the validation code from the schema. This is done by the generate-converter-v02.mjs script.

To install the node packages: `npm install` 

Then to run: `npm run generate-converter-v02` 

## Upgrading
The convertConfigV01toV02.mjs is a script that helped with the conversion of V01 to V02

Changing the schema was a painful exercise:
* Javascript uses references in hierarchical data structures and this can create issues e.g. code that worked with a shallow data structure breaks with a deeper data structure.
* Common names make it hard to do global search & replace. A more semantic search and replace would help a lot.
* Formatting the code with Prettier should make for easier search & replace

## History
Moving from v0.1 to v0.2 was a major hassle because v0.1 was a "flat" object and v0.2 has a hierarchical structure e.g. name
Javascript does not have a compact way for accessing keys e.g. {name: "toto"} is not possible
Updating objects in React also becomes more complicated as the ...task is shallow and we need to manage the deep merge/update of objects.

The basic approach to updating the Task Processor code is to use the taskV01toV02Map.mjs functions so parts of the system can be converted to v0.2 progressively rather than having everything break at once. For example if a function is dealing with a task then at the beginning `task = fromV01toV02(task)` then update the code for v0.2 and at the end of hte code block `task = fromV02toV01(task)`. Then once all the React Task Processor or NodeJS Task Processor code is moved we can place the conversion at the API, eventually only the communication is in v0.1 then it can be dropped. 

I modified the task object to suport a v02 field that held the new v0.2 object. It has the advantage of being able to view the content and spot problems with taskV01toV02Map.mjs 

Moving from v0.1 to v0.2 also makes a split between generic Task data and specific task data. Eventually each specific Task would have a schema.

