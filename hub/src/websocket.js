/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTaskProcessorsStore_async, activeTasksStore_async } from "./storage.mjs";
import { hubId } from "../config.mjs";
import { utils } from "./utils.mjs";

function wsSendObject(processorId, message = {}) {
  let ws = connections.get(processorId);
  if (!ws) {
    console.log("Lost websocket for wsSendObject", processorId, message);
  } else {
    if (!message?.task) {
      throw new Error("Missing task in wsSendObject" + JSON.stringify(message));
    }
    // Need to make a copy so any changes here d onot impact the object 
    let localTask = { ...message.task }
    localTask.hubId = hubId;
    message.task = localTask;
    ws.send(JSON.stringify(message));
    if (message.command !== "pong") {
      //console.log("wsSendObject ", JSON.stringify(message) )
    }
  }
}

const wsSendTask = async function (task, command = null) {
  //console.log("wsSendTask " + message)
  let message = {}
  if (command) {
    message["command"] = command;
  }
  if (command === "update") {
    const activeTask = await activeTasksStore_async.get(task.instanceId);
    let diff = {}
    if (activeTask) { 
      //console.log("wsSendTask task.output.msgs", task.output?.msgs)
      //console.log("wsSendTask activeTask.output.msgs", activeTask.output?.msgs)
      diff = utils.getObjectDifference(task, activeTask); // favour task
      //console.log("wsSendTask diff.output.msgs", diff.output?.msgs)
      if (Object.keys(diff).length === 0) {
        console.log("wsSendTask no diff", diff);
        return null;
      }
      diff.instanceId = task.instanceId;
      diff.stackPtr = task.stackPtr;
      diff.destination = task.destination;
      message["task"] = diff;
      //console.log("wsSendTask diff", diff);
    }
  } else {
    message["task"] = task;
  }
  let processorId = message.task.destination;
  if (message.command !== "pong") {
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

      if (j?.task) {
        const processorId = j.task.source;
        //console.log("processorId", processorId)
        if (ws.data["processorId"] !== processorId) {
          connections.set(processorId, ws);
          ws.data["processorId"] = processorId;
          console.log("Websocket processorId", processorId)
        }
        const activeProcessors = await activeTaskProcessorsStore_async.get(j.task.instanceId);
        // We have the processor list in activeTasksStore and in sessionsStore
        // Do we need the ssessionsStore?
        if (j.command === "update") {throw new Error("update not implemented")}
        if (j.command === "partial") {
          //console.log("ws update", j.task)
          if (!activeProcessors) {
            // This can happen if the React processor has not yet registered after a restart of the Hub
            console.log("No processors for ", j.task.id, j.task.instanceId, " in activeProcessorsStore");
            return;
            //throw new Error("No processors ", j.task);
          } else {
            //console.log("Number of processors " + activeTask.processorIds.length)
          }
          for (const id of activeProcessors) {
            if (id !== j.task.source) {
              const ws = connections.get(id);
              if (!ws) {
                console.log("Lost websocket for ", id, connections.keys());
              } else {
                //console.log("Forwarding " + j.command + " to " + id + " from " + processorId)
                j.task.destination = id;
                wsSendTask(j.task, j.command);
              }
            }
          }
        }
        
      }

      if (j?.command === "ping") {
        let currentDateTime = new Date();
        let currentDateTimeString = currentDateTime.toString();
        const task = {
          updatedeAt: currentDateTimeString,
          sessionId: j.task?.sessionId, 
          destination: j.task.source,
        };
        wsSendTask(task, "pong");
        //console.log("Pong " + j.task?.sessionId + " " + j.task.source)
      }

    });

    ws.on("close", function (code, reason) {
      console.log("ws processorId " + ws.data.processorId + " is closed with code: " + code + " reason: ", reason);
      if (ws.data.processorId) {
        connections.delete(ws.data.processorId);
      }
    });

    ws.on('error', function(error) {
      console.error("Websocket error: ", error);
      if (ws.data.processorId) {
        connections.delete(ws.data.processorId);
      }
    });

  });
};

export { initWebSocketServer, wsSendObject, wsSendTask };
