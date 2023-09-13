/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeProcessorTasksStore_async, activeProcessors, activeCoprocessors } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { commandUpdate_async } from "./commandUpdate.mjs";
import { commandStart_async } from "./commandStart.mjs";
import { commandInit_async } from "./commandInit.mjs";
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
    ws.send(JSON.stringify(message));
    if (message.task.hub.command !== "pong") {
      //console.log("wsSendObject message.task.output.sending", message.task?.output?.sending);
      //console.log("wsSendObject ", processorId, message.task.processor )
    }
  }
}

const wsSendTask = async function (task, processorId, activeTask) {
  if (!task?.hub?.command) {
    throw new Error("Missing hub.command in wsSendTask" + JSON.stringify(task));
  }
  //console.log("wsSendTask task.request", task.request)
  task = JSON.parse(JSON.stringify(task)); //deep copy because we make changes e.g. task.processor
  // hubDiff will remove processors and users
  let processor;
  if (task.processors && task.processors[processorId]) {
    processor = JSON.parse(JSON.stringify(task.processors[processorId]));
  }
  let user;
  if (task.user && task.users && task.user.id && task.users[task.user.id]) {
    user = JSON.parse(JSON.stringify(task.users[task.user.id]));
  }
  let message = {}
  // We can only have an activeTask for an update command
  if (task.hub.command === "update") {
    //utils.logTask(task, "wsSendTask " + command + " activeTask state", activeTask.state);
    //utils.logTask(task, "wsSendTask " + command + " task state", task.state);
    let diff = {}
    if (activeTask) {
      diff = utils.hubDiff(activeTask, task);
      if (Object.keys(diff).length === 0) {
        utils.logTask(task, "wsSendTask no diff", diff);
        return null;
      }
      task = diff;
    } else {
      throw new Error("Update but no active task for " + task.id);
    }
  }
  //utils.logTask(task, "wsSendTask " + command + " message state", message["task"].state);
  // For example task.command === "partial" does not have task.processors
  //utils.logTask(task, "wsSendTask task.hub", task.hub);
  if (processor) {
    //utils.logTask(task, "wsSendTask task.processors", processorId, task.processors);
    //deep copy because we are going to edit the object
    task["processor"] = processor;
    task.processor["command"] = null;
    task.processor["commandArgs"] = null;
    delete task.processors;
  } else {
    task.processor = {};
  }
  const { coprocessingPosition, coprocessing, coprocessingDone, initiatingProcessorId, sourceProcessorId } = task.hub;
  if (task.processor.isCoprocessor) {
    task.processor["coprocessingPosition"] = coprocessingPosition;
    task.processor["coprocessing"] = coprocessing;
    task.processor["coprocessingDone"] = coprocessingDone;
  }
  task.processor["initiatingProcessorId"] = initiatingProcessorId;
  task.processor["sourceProcessorId"] = sourceProcessorId;
  if (user) {
    if (!task?.user?.id) {
      utils.logTask(task, "wsSendTask no user", task);
    }
    task["user"] = user;
    delete task.users;
  }
  task.meta = task.meta || {};
  if (task.hub.command !== "pong") {
    //utils.logTask(task, "wsSendTask sourceProcessorId " + task.hub.sourceProcessorId)
    //utils.logTask(task, "wsSendTask task " + (task.id || task.instanceId )+ " to " + processorId)
    //utils.logTask(task, "wsSendTask task.hub.commandArgs.sync", task?.hub?.commandArgs?.sync);
  }
  delete task.hub.origTask;
  message["task"] = task;
  //utils.logTask(task, "wsSendTask task.processor.stateLast", task.processor.stateLast, task.processor.id);
  utils.debugTask(task);
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
        if (!activeProcessors.has(processorId) && !activeCoprocessors.has(processorId)) {
          // Need to register again
          let currentDateTime = new Date();
          let currentDateTimeString = currentDateTime.toString();
          const task = {
            updatedeAt: currentDateTimeString,
            hub: {command: "register"},
            processor: {},
          };
          console.log("Request for registering " + processorId)
          wsSendTask(task, processorId);
          return;
        }
      }

      if (j?.task && j.task?.processor?.command !== "ping") {
        let task = j.task;
        task = await taskProcess_async(task);

        // taskProcess_async has sent task to coprocessor
        if (task === null) {
          return;
        }

        const byteSize = Buffer.byteLength(message, 'utf8');
        utils.logTask(task, `Message size in bytes: ${byteSize} from ${task?.hub?.sourceProcessorId}`);

        // If there are multiple coprocessors then we may need to specify a priority
        // We start the co-processing from taskSync.mjs

        const coprocessors = Array.from(activeCoprocessors.keys());
        const wasLastCoProcessor = task.hub?.coprocessingPosition === (coprocessors.length - 1);

        // Most of the coprocessing code could be moved into taskProcess_async ?
        let processorId;
        if (task.hub.coprocessing && wasLastCoProcessor) {
          utils.logTask(task, "wasLastCoProcessor so stop coprocessing")
          task.hub.coprocessing = false;
          processorId = task.hub.initiatingProcessorId
          task.hub.sourceProcessorId = processorId;
        } else {
          processorId = task.hub.sourceProcessorId;
        }

        if (task.hub.command !== "partial") {
          //utils.logTask(task, "isCoprocessor " + task.processor.isCoprocessor + " wasLastCoProcessor " + wasLastCoProcessor + " task.hub.coprocessingPosition " + task.hub?.coprocessingPosition + " processorId " + processorId);
        }

        // Have not tested this yet because we only have one coprocessor
        // There is very similar code in taskSync.mjs
        if (task.processor.isCoprocessor && task.hub.coprocessing && !wasLastCoProcessor) {
          utils.logTask(task, "Looking for NEXT coprocessor");
          // Send through the coprocessors
          // The task.hub.coprocessingPosition decides which coprocessor to run
          // It would be faster to chain the coprocessors directly as this avoids a request/response from the hub
          task.hub.coprocessingPosition++;
          // Should loop over the coprocessors to deal with case where command is not supported
          const coprocessorId = coprocessors[task.hub.coprocessingPosition];
          const coprocessorData = activeCoprocessors.get(coprocessorId);
          if (coprocessorData && coprocessorData.commandsAccepted.includes(task.hub.command)) {
            const ws = connections.get(coprocessorId);
            if (!ws) {
              utils.logTask(task, "Lost websocket for ", coprocessorId, connections.keys());
            } else {
              utils.logTask(task, "Websocket coprocessor chain", coprocessorId);
              // If the task is only on one co-processor at a time then we could just use task.coprocessor ?
              if (!task.processors[coprocessorId]) {
                task.processors[coprocessorId] = {id: coprocessorId, isCoprocessor: true};
              }
              task.hub["coprocessing"] = true;
              task.hub["coprocessingDone"] = false;
              wsSendTask(task, coprocessorId);
            }
          }
        }

        if (!task.hub.coprocessing) {
          const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
          // Allows us to track where the request came from while coprocessors are in use
          processorId = task.hub.initiatingProcessorId || processorId;
          task.processor = task.processors[processorId];
          task.hub.sourceProcessorId = processorId;
          task.hub["coprocessingPosition"] = null;
          if (wasLastCoProcessor) {
            if (task.hub.command !== "partial") {
              utils.logTask(task, "Finished with coprocessors id:", task.id, "processorId:", processorId);
              utils.logTask(task, "initiatingProcessorId", task.hub["initiatingProcessorId"]);
            }
            task.hub["coprocessingDone"] = true;
          }
          // Updates through WS can only come from RxJS for now
          if (task.hub.command === "update") {
            utils.logTask(task, "WS update from:" + task.hub.sourceProcessorId);
            commandUpdate_async(task);
          }
          if (task.hub.command === "start") {
            utils.logTask(task, "WS start from:" + task.hub.sourceProcessorId);
            commandStart_async(task);
          }
          if (task.hub.command === "init") {
            utils.logTask(task, "WS init from:" + task.hub.sourceProcessorId);
            commandInit_async(task);
          }
          if (task.hub.command === "error") {
            utils.logTask(task, "WS error from:" + task.hub.sourceProcessorId);
            commandError_async(task);
          }
          if (task.hub.command === "partial") {   
            for (const id of activeTaskProcessors) {
              if (id !== processorId) {
                const processorData = activeProcessors.get(id);
                if (processorData && processorData.commandsAccepted.includes(task.hub.command)) {
                  const ws = connections.get(id);
                  if (!ws) {
                    utils.logTask(task, "Lost websocket for ", id, connections.keys());
                  } else {
                    //utils.logTask(task, "Forwarding " + task.hub.command + " to " + id + " from " + processorId)
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
          processor: {},
        };
        //utils.logTask(task, "Pong " + j.task.processor.id)
        wsSendTask(task, j.task.processor.id);
      }

    });

    ws.on("close", async function (code, reason) {
      const processorId = ws.data.processorId;
      console.log("ws processorId " + processorId + " is closed with code: " + code + " reason: ", reason);
      if (processorId) {
        connections.delete(processorId);
        activeProcessors.delete(processorId);
        activeCoprocessors.delete(processorId);
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
}

export { initWebSocketServer, wsSendTask };
