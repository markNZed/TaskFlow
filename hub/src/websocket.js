/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeTasksStore_async, activeProcessors } from "./storage.mjs";
import { hubId } from "../config.mjs";
import { utils } from "./utils.mjs";

function wsSendObject(processorId, message = {}) {
  let ws = connections.get(processorId);
  if (!ws) {
    console.log("Lost websocket for wsSendObject", processorId, message.task);
  } else {
    if (!message?.task) {
      throw new Error("Missing task in wsSendObject" + JSON.stringify(message));
    }
    ws.send(JSON.stringify(message));
    if (message.task.hub.command !== "pong") {
      //console.log("wsSendObject ", processorId, JSON.stringify(message.task.processor) )
    }
  }
}

const wsSendTask = async function (task, processorId = null) {
  if (!task?.hub?.command) {
    throw new Error("Missing hub.command in wsSendTask" + JSON.stringify(task));
  }
  let command = task.hub.command;
  let commandArgs = task.hub?.commandArgs;
  let processor = task.processor;
  //console.log("wsSendTask", task)
  task = JSON.parse(JSON.stringify(task)); //deep copy because we make changes e.g. task.processor
  let message = {}
  if (command === "update") {
    const activeTask = await activeTasksStore_async.get(task.instanceId);
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
      diff.stackPtr = task.stackPtr;
      diff["hub"] = {};
      diff.hub["command"] = command;
      diff.hub["commandArgs"] = commandArgs;
      diff.processor = processor;
      message["task"] = diff;
    }
  } else {
    message["task"] = task;
  }
  if (message.task?.processor) {
    //deep copy because we are going to edit the object
    message.task.processor = JSON.parse(JSON.stringify(message.task.processor[processorId]));
    message.task.processor.command = null;
    if (message.task.processor?.commandArgs) {
      message.task.processor.commandArgs = null;
    }
  }
  if (command !== "pong") {
    //console.log("wsSendTask task " + (message.task.id || message.task.instanceId )+ " to " + processorId)
  }
  wsSendObject(processorId,message);
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
        const task = j.task;
        const command = task.processor.command;
        const commandArgs = task.processor?.commandArgs;
        const processorId = task.processor.id;
        delete task.processor.command;
        delete task.processor.commandArgs;
        if (!command) {
          throw new Error("Missing command in task.hub " + JSON.stringify(task));
        }
        const activeTaskProcessors = await activeTaskProcessorsStore_async.get(task.instanceId);
        if (command === "update") {throw new Error("update not implemented")}
        if (command === "partial") {
          //console.log("ws update", task)
          if (!activeTaskProcessors) {
            // This can happen if the React processor has not yet registered after a restart of the Hub
            console.log("No processors for ", task.id, task.instanceId, " in activeTaskProcessorsStore_async");
            return;
            //throw new Error("No processors ", task);
          } else {
            //console.log("Number of processors " + activeTask.processorIds.length)
          }
          const activeTask = await activeTasksStore_async.get(task.instanceId);
          // Restore the other processors
          const processor = activeTask.processor;
          //console.log("processor", processor);
          task.processor = processor;
          task.hub = activeTask.hub;
          task.hub["command"] = command;
          task.hub["commandArgs"] = commandArgs;
          task.hub["sourceProcessorId"] = processorId;     
          for (const id of activeTaskProcessors) {
            if (id !== processorId) {
              const ws = connections.get(id);
              if (!ws) {
                console.log("Lost websocket for ", id, connections.keys());
              } else {
                //console.log("Forwarding " + j.command + " to " + id + " from " + processorId)
                wsSendTask(task, id);
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

    ws.on("close", function (code, reason) {
      console.log("ws processorId " + ws.data.processorId + " is closed with code: " + code + " reason: ", reason);
      if (ws.data.processorId) {
        connections.delete(ws.data.processorId);
        activeProcessors.delete(ws.data.processorId);
      }
    });

    ws.on('error', function(error) {
      console.error("Websocket error: ", error);
      if (ws.data.processorId) {
        connections.delete(ws.data.processorId);
        activeProcessors.delete(ws.data.processorId);
      }
    });

  });
};

export { initWebSocketServer, wsSendTask };
