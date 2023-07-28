/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeProcessorTasksStore_async, activeTasksStore_async, activeProcessors, activeCoProcessors } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { updateCommand_async } from "./updateCommand.mjs";
import { startCommand_async } from "./startCommand.mjs";
import { errorCommand_async } from "./errorCommand.mjs";
import { transferCommand } from "./routes/taskProcessing.mjs";
import { taskHash } from "./shared/utils.mjs";

let taskMessageCount = 0;

/**
 * Sends an object through the WebSocket connection identified by the given processor ID.
 *
 * @param {string} processorId - The ID of the WebSocket connection to use.
 * @param {Object} [message={}] - The object to send through the connection.
 * @throws {Error} If the message object does not have a task property.
 */
function wsSendObject(processorId, message = {}) {
  const ws = connections.get(processorId);
  if (!ws) {
    console.error(`Lost websocket for wsSendObject with processorId ${processorId} and message task ${message.task}`);
  } else {
    if (!message?.task) {
      throw new Error(`Missing task in wsSendObject: ${JSON.stringify(message)}`);
    }
    ws.send(JSON.stringify(message));
    if (message.task.hub.command !== "pong") {
      //console.log("wsSendObject ", processorId, message.task.processor )
    }
  }
}

const wsSendTask = async function (task, processorId = null) {
  if (!task?.hub?.command) {
    throw new Error("Missing hub.command in wsSendTask" + JSON.stringify(task));
  }
  let command = task.hub.command;
  let commandArgs = task.hub?.commandArgs;
  let coProcessorPosition = task.hub?.coProcessorPosition;
  let sourceProcessorId = task.hub?.sourceProcessorId;
  let coProcessingDone = task.hub?.coProcessingDone;
  let coProcessing = task.hub?.coProcessing;
  let processors = task.processors;
  let users = task.users;
  //console.log("wsSendTask", task)
  task = JSON.parse(JSON.stringify(task)); //deep copy because we make changes e.g. task.processor
  let message = {}
  if (command === "update" || command === "sync") {
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    //console.log("wsSendTask " + command + " activeTask state", activeTask.state);
    //console.log("wsSendTask " + command + " task state", task.state);
    let diff = {}
    if (activeTask) { 
      //console.log("wsSendTask task.output.msgs", task.output?.msgs)
      //console.log("wsSendTask activeTask.output.msgs", activeTask.output?.msgs)
      diff = utils.getObjectDifference(activeTask, task); // keep the differences in task
      //console.log("wsSendTask diff.output.msgs", diff.output?.msgs)
      //console.log("wsSendTask diff", diff)
      if (Object.keys(diff).length === 0) {
        console.log("wsSendTask no diff", diff);
        return null;
      }
       // Because this routes the task but does not change so need to add back in
       // Points to a class of concern
      diff.instanceId = task.instanceId;
      diff["hub"] = {};
      // This is not cool, needs a clean up
      // We need to be sharing how hub/processors handle communication e.g. transferCommand 
      diff.hub["command"] = command;
      diff.hub["commandArgs"] = commandArgs;
      diff.hub["coProcessorPosition"] = coProcessorPosition;
      diff.hub["sourceProcessorId"] = sourceProcessorId;
      diff.hub["coProcessingDone"] = coProcessingDone;
      diff.hub["coProcessing"] = coProcessing;
      diff.processors = processors;
      diff.users = users;
      if (!diff.meta) {
        diff["meta"] = {};
      }
      if (task.meta.locked) {
        diff.meta["locked"] = task.meta.locked;
      }
      message["task"] = diff;
    } else {
      throw new Error("Update but no active task for " + task.id);
    }
  } else {
    message["task"] = task;
  }
  //console.log("wsSendTask " + command + " message state", message["task"].state);
  // For example task.command === "partial" does not have task.processors
  //console.log("wsSendTask message.task.hub", message.task.hub);
  if (message.task?.processors) {
    //console.log("wsSendTask message.task.processors", processorId, message.task.processors);
    //deep copy because we are going to edit the object
    message.task.processor = JSON.parse(JSON.stringify(message.task.processors[processorId]));
    message.task.processor.command = null;
    if (message.task.processor?.commandArgs) {
      message.task.processor.commandArgs = null;
    }
    message.task.processor["coProcessorPosition"] = coProcessorPosition;
    message.task.processor["sourceProcessorId"] = sourceProcessorId;
    message.task.processor["coProcessingDone"] = coProcessingDone;
    message.task.processor["coProcessing"] = coProcessing;
    delete message.task.processors;
  }
  if (message.task?.users) {
    message.task.user = JSON.parse(JSON.stringify(message.task.users[task.user.id]));
    delete message.task.users;
  }
  message.task.meta = message.task.meta || {};
  message.task.meta.messageCount = taskMessageCount;
  if (command !== "pong") {
    //console.log("wsSendTask sourceProcessorId " + message.task.hub.sourceProcessorId)
    //console.log("wsSendTask task " + (message.task.id || message.task.instanceId )+ " to " + processorId)
    //console.log("wsSendTask message.task.hub.commandArgs.sync", message.task?.hub?.commandArgs?.sync);
  }
  if (message.task.meta.hash) {
    const testHash = taskHash(task);  
    if (message.task.meta.hash !== testHash) {
      console.log("wsSendTask hash MISMATCH", testHash, message.task.meta.hash);
    }
  }
  wsSendObject(processorId, message);
  taskMessageCount++;
}

function initWebSocketServer(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    ws.data = { processorId: undefined };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      if (j?.task?.processor?.id) {
        const processorId = j.task.processor.id;
        //console.log("processorId", processorId)
        if (!connections.get(processorId)) {
          connections.set(processorId, ws);
          ws.data["processorId"] = processorId;
          console.log("Websocket processorId", processorId)
        }
        if (!activeProcessors.has(processorId) && !activeCoProcessors.has(processorId)) {
          // Need to register again
          let currentDateTime = new Date();
          let currentDateTimeString = currentDateTime.toString();
          const task = {
            updatedeAt: currentDateTimeString,
            hub: {command: "register"},
          };
          console.log("Request for registering " + processorId)
          wsSendTask(task, processorId);
          return;
        }
      }

      if (j?.task && j.task?.processor?.command !== "ping") {
        let task = j.task;
        const activeTask = await activeTasksStore_async.get(task.instanceId);
        task = transferCommand(task, activeTask, null);

        // If there are multiple coprocessors then we may need to specify a priority
        // We start the co-processing from syncTask.mjs
        // Currently update/sync requests via websocket are only coming from co-processor

        let processorId = task.hub.sourceProcessorId;
        const coProcessors = Array.from(activeCoProcessors.keys());
        const isCoProcessor = coProcessors.includes(processorId);
        const wasLastCoProcessor = task.hub?.coProcessorPosition === (coProcessors.length - 1);

        if (task.hub.coProcessing && wasLastCoProcessor) {
          console.log("wasLastCoProcessor so stop coProcessing")
          task.hub.coProcessing = false;
          task.hub.coProcessingDone = true;
        }
        const coProcessing = task.hub.coProcessing;

        if (task.hub.command !== "partial") {
          //console.log("isCoProcessor " + isCoProcessor + " wasLastCoProcessor " + wasLastCoProcessor + " task.hub.coProcessorPosition " + task.hub?.coProcessorPosition + " processorId " + processorId);
        }

        // Have not tested this yet because we only have one coprocessor
        if (isCoProcessor && coProcessing && !wasLastCoProcessor) {
          console.log("Looking for NEXT coprocessor");
          // Send through the coProcessors
          // The task.hub.coProcessorPosition decides which coProcessor to run
          // It would be faster to chain the coprocessors directly as this avoids a request/response from the hub
          task.hub.coProcessorPosition++;
          // Should loop over the coprocessors to deal with case where command is not supported
          const coProcessorId = coProcessors[task.hub.coProcessorPosition];
          const coProcessorData = activeCoProcessors.get(coProcessorId);
          if (coProcessorData && coProcessorData.commandsAccepted.includes(task.hub.command)) {
            const ws = connections.get(coProcessorId);
            if (!ws) {
              console.log("Lost websocket for ", coProcessorId, connections.keys());
            } else {
              //console.log("Forwarding " + task.hub.command + " to " + coProcessorId + " from " + task.hub["sourceProcessorId"])
              if (!task.processors[coProcessorId]) {
                task.processors[coProcessorId] = {id: coProcessorId, isCoProcessor: true};
                console.log("task missing coprocessor", coProcessorId );
              }      
              wsSendTask(task, coProcessorId);
            }
          }
        }

        if (!coProcessing) {
          const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
          // Allows us to track where the request came fomr while coprocessors are in use
          processorId = task.meta.initiatingProcessorId || processorId;
          task.processor = task.processors[processorId];
          task.hub.sourceProcessorId = processorId;
          task.hub["coProcessorPosition"] = null;
          task.meta["initiatingProcessorId"] = null;
          if (wasLastCoProcessor && task.hub.command !== "partial") {
            console.log("Finished with coProcessors", task.id, processorId);
            console.log("initiatingProcessorId", task.meta["initiatingProcessorId"]);
            task.hub["coProcessingDone"] = true;
          }
          // Updates through WS can only come from RxJS for now
          if (task.hub.command === "update") {
            console.log("");
            console.log("WS update", task.id);
            updateCommand_async(task);
          }
          if (task.hub.command === "start") {
            console.log("");
            console.log("WS start", task.id);
            startCommand_async(task);
          }
          if (task.hub.command === "error") {
            console.log("");
            console.log("WS error", task.id);
            errorCommand_async(task);
          }
          if (task.hub.command === "partial") {   
            for (const id of activeTaskProcessors) {
              if (id !== processorId) {
                const processorData = activeProcessors.get(id);
                if (processorData && processorData.commandsAccepted.includes(task.hub.command)) {
                  const ws = connections.get(id);
                  if (!ws) {
                    console.log("Lost websocket for ", id, connections.keys());
                  } else {
                    //console.log("Forwarding " + task.hub.command + " to " + id + " from " + processorId)
                    wsSendTask(task, id);
                  }
                }
              }
            }
          }
        }
      }

      if (j?.task?.processor?.command === "ping") {
        let currentDateTime = new Date();
        let currentDateTimeString = currentDateTime.toString();
        const task = {
          updatedeAt: currentDateTimeString,
          hub: {command: "pong"},
        };
        //console.log("Pong " + j.task.processor.id)
        wsSendTask(task, j.task.processor.id);
      }

    });

    ws.on("close", async function (code, reason) {
      const processorId = ws.data.processorId;
      console.log("ws processorId " + processorId + " is closed with code: " + code + " reason: ", reason);
      if (processorId) {
        connections.delete(processorId);
        activeProcessors.delete(processorId);
        const activeProcessorTasks = await activeProcessorTasksStore_async.get(processorId);
        if (activeProcessorTasks) {
          // for each task delete entry from activeTaskProcessorsStore_async
          for (const taskId of activeProcessorTasks) {
            let activeTaskProcessors = await activeTaskProcessorsStore_async.get(taskId);
            if (activeTaskProcessors) {
              console.log("Removing processor " + processorId + " from task " + taskId);
              activeTaskProcessors = activeTaskProcessors.filter(id => id !== processorId);
              if (activeTaskProcessors.length > 0) {
                await activeTaskProcessorsStore_async.set(taskId, activeTaskProcessors);
              } else {
                console.log("No processor for task " + taskId);
                await activeTaskProcessorsStore_async.delete(taskId);                
              }
            }
          }
          await activeProcessorTasksStore_async.delete(processorId);
        }
      }
    });

    // Assuming that close is called after error - need to check this assumption
    ws.on('error', function(error) {
      console.error("Websocket error: ", error);
    });

  });
};

export { initWebSocketServer, wsSendTask };
