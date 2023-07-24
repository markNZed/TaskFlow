/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeProcessorTasksStore_async, activeTasksStore_async, activeProcessors } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { syncCommand_async } from "./syncCommand.mjs";
import { transferCommand } from "./routes/taskProcessing.mjs";

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
      //console.log("wsSendObject ", processorId, JSON.stringify(message.task) )
    }
  }
}

const wsSendTask = async function (task, processorId = null) {
  if (!task?.hub?.command) {
    throw new Error("Missing hub.command in wsSendTask" + JSON.stringify(task));
  }
  let command = task.hub.command;
  let commandArgs = task.hub?.commandArgs;
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
      diff.hub["command"] = command;
      diff.hub["commandArgs"] = commandArgs;
      diff.processors = processors;
      diff.users = users;
      if (!diff.meta) {
        diff["meta"] = {};
      }
      diff.meta["sourceProcessorId"] = task.meta.sourceProcessorId;
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
  if (message.task?.processors) {
    //deep copy because we are going to edit the object
    message.task.processor = JSON.parse(JSON.stringify(message.task.processors[processorId]));
    message.task.processor.command = null;
    if (message.task.processor?.commandArgs) {
      message.task.processor.commandArgs = null;
    }
    delete message.task.processors;
  }
  if (message.task?.users) {
    message.task.user = JSON.parse(JSON.stringify(message.task.users[task.user.id]));
    delete message.task.users;
  }
  message.task.meta = message.task.meta || {};
  message.task.meta.messageCount = taskMessageCount;
  if (command !== "pong") {
    //console.log("wsSendTask task " + (message.task.id || message.task.instanceId )+ " to " + processorId)
  }
  wsSendObject(processorId,message);
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
        if (!activeProcessors.has(processorId)) {
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

      if (j?.task) {
        console.log("");
        let task = j.task;
        const activeTask = await activeTasksStore_async.get(task.instanceId);
        task = transferCommand(task, activeTask, null);
        const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
        if (task.hub.command === "update") {throw new Error("update not implemented")}
        if (task.hub.command === "sync") {
          console.log("ws sync", task.id)
          syncCommand_async(task);
        }
        if (task.hub.command === "partial") {   
          for (const id of activeTaskProcessors) {
            if (id !== task.hub["sourceProcessorId"]) {
              const processorData = activeProcessors.get(id);
              if (processorData && processorData.commandsAccepted.includes(task.hub.command)) {
                const ws = connections.get(id);
                if (!ws) {
                  console.log("Lost websocket for ", id, connections.keys());
                } else {
                  //console.log("Forwarding " + task.hub.command + " to " + id + " from " + task.hub["sourceProcessorId"])
                  wsSendTask(task, id);
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
