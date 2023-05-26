/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, activeTasksStore_async } from "./storage.mjs";
import { hubId } from "../config.mjs";

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
    // The destination is available because nodejs does not initiate websocket connections
    localTask.destination = ws.data.destination;
    localTask.hubId = hubId;
    localTask.newSource = hubId;
    message.task = localTask;
    ws.send(JSON.stringify(message));
    if (message.command !== "pong") {
      //console.log("wsSendObject ", JSON.stringify(message) )
    }
  }
}

const wsSendTask = function (task, command = null) {
  //console.log("wsSendTask " + message)
  let message = {}
  message["task"] = task;
  if (command) {
    message["command"] = command;
  }
  let processorId = message.task.newDestination;
  if (message.command !== "pong") {
    console.log("wsSendTask task " + (message.task.id || message.task.instanceId )+ " to " + processorId)
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
        const processorId = j.task.newSource;
        //console.log("processorId", processorId)
        if (ws.data["processorId"] !== processorId) {
          connections.set(processorId, ws);
          ws.data["processorId"] = processorId;
          console.log("Websocket processorId", processorId)
        }
        const activeTask = await activeTasksStore_async.get(j.task.instanceId);
        // We have the processor list in activeTasksStore and in sessionsStore
        // Do we need the ssessionsStore?
        if (j.command === "update" || j.command === "partial") {
          //console.log("ws update", j.task)
          if (!activeTask.processorIds) {
            throw new Error("No processors ", j.task);
          } else {
            //console.log("Number of processors " + activeTask.processorIds.length)
          }
          console.log("Forwarding " + j.command + " from " + processorId)
          for (const id of activeTask.processorIds) {
            if (id !== j.task.newSource) {
              const ws = connections.get(id);
              if (!ws) {
                console.log("Lost websocket for ", id, connections.keys());
              } else {
                //console.log("Forwarding " + j.command + " to " + id + " from " + processorId)
                j.task.newDestination = id;
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
          newDestination: j.task.newSource,
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
