# Task Hub

The Task Hub is implemented in node using the Express framework and SQLite database.

This is just a placeholder for now, the function is currently performed by nodejsProcessor.

* User details (currently users.mjs)
  * Provide a lis tof available "start" tasks (UI should look afte rconstructing menu hierarchy)
* Groups (currently groups.mjs)
* Available Tasks (currently taskflows.mjs) 
  * Should the Hub start tasks so it can send the Task to a Processor with the appropriate Environment?
* Task instances (currently in db/main.sqlite)
  * Threads (currently in db/main.sqlite)

What about messagesStore_async ?


Through JS imports the Task has access to:
              config.mjs
              src/configdata.mjs (users, groups, taskflows, components, tasks)
              src/utils.mjs
              src/storage.mjs (messagesStore_async, sessionsStore_async, cacheStore_async, instancesStore_async, threadsStore_async, connections)
              src/websocket.js (wsSendObject)
              .env