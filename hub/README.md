# Task Hub

The Task Hub is implemented in node using the Express framework and SQLite database.

This is just a placeholder for now, the function is currently performed by NodeJS Task Processor.

* User details (currently users.mjs)
  * Provide a list of available "start" tasks (UI should look afte rconstructing menu hierarchy)
* Groups (currently groups.mjs)
* Available Tasks (currently taskflows.mjs) 
  * Should the Hub start tasks so it can send the Task to a Processor with the appropriate Environment?
* Task instances (currently in db/main.sqlite)
  * Threads (currently in db/main.sqlite)
* The sessionId is set by the Task Hub

The Task Processors need to register with the Task Hub. 

Through JS imports the Task has access to:
              config.mjs
              src/configdata.mjs (users, groups, taskflows, tasktemplates, tasks)
              src/utils.mjs
              src/storage.mjs (messagesStore_async, sessionsStore_async, cacheStore_async, instancesStore_async, threadsStore_async, connections)
              src/websocket.js (wsSendObject)
              .env

The Task Hub should allow for stacking i.e., many Task Hubs that can be coordinated by a Task Hub. Maybe the Task Hub does not need to know if it is communicating with a Task Hub or Task Processor.

Should the Task Processor start new Tasks or should this be done by the Task Hub? Simpler to always start new Tasks from the Task Hub. So the Task Processor deals with updating and the Task Hub with starting.

Currently we start a Task on the Browser from the broser, the Task is returned to the Browser, then the Task will update but how does it know where to send the Task? Currently hard coded. It should request a Task Environment and the Task Hub should point to the Task Processor. Maybe upon starting the Task Hub should provide that information , so the Task includes an object that lists the environments it needs and the Task Hub provides the information to the Task. For example, the Tasks need the LLM and nodejs provides that. What about user data, we can't provide all the data with the task, the Task needs to request this from the Task Hub (could be part of the request during start). 

Split nodejs into update and move start into Task Hub. This will be another server.

How is a start requst formatted? As a generic Task (no id etc). Provide a command interface. The command is a verb.

Completed tasks should be archived on the hub. Need a simple way to get outputs from previuos Tasks. ThreadId + id + output value in a keyv store.

Need to be able to fetch available Start Tasks. Taskflows are stored on the Task Hub. How are these eventually managed? Task Processor needs to provide a Taskflow specific environment where Taskflows can be fetched, modified etc. Then a Task Flow is just transferred as part of the data in a Task. But the Task Hub would need to implement commands to manage this.

Maybe we need the idea of TaskTemplate to replace component?

# Start
This is the Task Hub T@skFlow
1. written in Node JS run-time, Express framework
2. fetched data is cached by SQLite

To install the node packages: `npm install` 

Then to run: `npm start`