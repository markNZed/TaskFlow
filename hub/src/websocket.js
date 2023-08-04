/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeProcessorTasksStore_async, activeTasksStore_async, activeProcessors, activeCoProcessors } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { commandError_async } from "./commandError.mjs";
import { taskProcess_async } from "./taskProcess.mjs";

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
      //console.log("wsSendObject message.task.output.sending", message.task?.output?.sending);
      //console.log("wsSendObject ", processorId, message.task.processor )
    }
  }
}

const wsSendTask = async function (task, processorId = null) {
  if (!task?.hub?.command) {
    throw new Error("Missing hub.command in wsSendTask" + JSON.stringify(task));
  }
  //console.log("wsSendTask", task)
  task = JSON.parse(JSON.stringify(task)); //deep copy because we make changes e.g. task.processor
  let message = {}
  let activeTask = {};
  if (task.hub.command === "update") {
    activeTask = await activeTasksStore_async.get(task.instanceId);
    activeTask.hub["origTask"] = JSON.parse(JSON.stringify(activeTask)); // deep copy to avoid self-reference
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
      diff.hub = task.hub;
      diff.processors = task.processors;
      diff.users = task.users;
      if (!diff.meta) {
        diff["meta"] = {};
      }
      if (task.meta.locked) {
        diff.meta["locked"] = task.meta.locked;
      }
      diff.meta["hash"] = activeTask.meta.hash;
      // In theory we could enable the hash debug in the task
      const hashDebug = true;
      if (hashDebug || task.meta.hashDebug) {
        delete activeTask.meta.hashTask;
        diff.meta["hashTask"] = JSON.parse(JSON.stringify(activeTask));
        delete diff.meta.hashTask.hub;
        delete diff.meta.hashTask.processors;
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
    message.task.processor["command"] = null;
    message.task.processor["commandArgs"] = null;
    if (message.task.processor.isCoProcessor) {
      message.task.processor["coProcessorPosition"] = task.hub.coProcessorPosition;
      message.task.processor["coProcessingDone"] = task.hub.coProcessingDone;
      message.task.processor["coProcessing"] = task.hub.coProcessing;
      message.task.processor["initiatingProcessorId"] = task.hub.initiatingProcessorId; // Only used by coprocessor ?
    }
    message.task.processor["sourceProcessorId"] = task.hub.sourceProcessorId;
    delete message.task.processors;
  }
  if (message.task?.users) {
    message.task.user = JSON.parse(JSON.stringify(message.task.users[task.user.id]));
    delete message.task.users;
  }
  message.task.meta = message.task.meta || {};
  if (task.hub.command !== "pong") {
    //console.log("wsSendTask sourceProcessorId " + message.task.hub.sourceProcessorId)
    //console.log("wsSendTask task " + (message.task.id || message.task.instanceId )+ " to " + processorId)
    //console.log("wsSendTask message.task.hub.commandArgs.sync", message.task?.hub?.commandArgs?.sync);
  }
  delete message.task.hub.origTask;
  wsSendObject(processorId, message);
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
        task = await taskProcess_async(task);

        const byteSize = Buffer.byteLength(message, 'utf8');
        console.log(`Message size in bytes: ${byteSize} from ${task?.hub?.sourceProcessorId}`);

        // If there are multiple coprocessors then we may need to specify a priority
        // We start the co-processing from taskSync.mjs
        // Currently update/sync requests via websocket are only coming from co-processor

        const coProcessors = Array.from(activeCoProcessors.keys());
        const wasLastCoProcessor = task.hub?.coProcessorPosition === (coProcessors.length - 1);

        // Most of the coprocessing code could be moved into taskProcess_async ?
        let processorId;
        if (task.hub.coProcessing && wasLastCoProcessor) {
          console.log("wasLastCoProcessor so stop coProcessing")
          task.hub.coProcessing = false;
          processorId = task.hub.initiatingProcessorId
          task.hub.sourceProcessorId = processorId;
        } else {
          processorId = task.hub.sourceProcessorId;
        }

        if (task.hub.command !== "partial") {
          //console.log("isCoProcessor " + task.processor.isCoProcessor + " wasLastCoProcessor " + wasLastCoProcessor + " task.hub.coProcessorPosition " + task.hub?.coProcessorPosition + " processorId " + processorId);
        }

        // Have not tested this yet because we only have one coprocessor
        // There is very similar code in taskSync.mjs
        if (task.processor.isCoProcessor && task.hub.coProcessing && !wasLastCoProcessor) {
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
              console.log("Websocket coprocessor chain", command, key, coProcessorId);
              // If the task is only on one co-processor at a time then we could just use task.coprocessor ?
              if (!task.processors[coProcessorId]) {
                task.processors[coProcessorId] = {id: coProcessorId, isCoProcessor: true};
              }
              taskCopy.hub["coProcessing"] = true;
              taskCopy.hub["coProcessingDone"] = false;
              wsSendTask(task, coProcessorId);
            }
          }
        }

        if (!task.hub.coProcessing) {
          const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
          // Allows us to track where the request came from while coprocessors are in use
          processorId = task.hub.initiatingProcessorId || processorId;
          task.processor = task.processors[processorId];
          task.hub.sourceProcessorId = processorId;
          task.hub["coProcessorPosition"] = null;
          if (wasLastCoProcessor) {
            if (task.hub.command !== "partial") {
              console.log("Finished with coProcessors", task.id, processorId);
              console.log("initiatingProcessorId", task.hub["initiatingProcessorId"]);
            }
            task.hub["coProcessingDone"] = true;
          }
          // Updates through WS can only come from RxJS for now
          if (task.hub.command === "update") {
            console.log("");
            console.log("WS update", task.id, " from:" + task.hub.sourceProcessorId);
            commandUpdate_async(task);
          }
          if (task.hub.command === "start") {
            console.log("");
            console.log("WS start", task.id, " from:" + task.hub.sourceProcessorId);
            commandStart_async(task);
          }
          if (task.hub.command === "error") {
            console.log("");
            console.log("WS error", task.id, " from:" + task.hub.sourceProcessorId);
            commandError_async(task);
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
