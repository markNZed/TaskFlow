/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections, sessionsStore_async, activeProcessors } from "./storage.mjs";
import { hubId } from "../config.mjs";

function wsSendObject(processorId, message = {}) {
  let ws = connections.get(processorId);
  if (!ws) {
    console.log("Lost websocket for wsSendObject", processorId, message);
  } else {
    if (!message?.task) {
      message["task"] = {}
    }
    // The destination is availalbe because nodejs does not initiate webscoket connections
    message.task.destination = ws.data.destination;
    message.task.hubId = hubId;
    ws.send(JSON.stringify(message));
    if (!message.task?.pong) {
      //console.log("wsSendObject ", JSON.stringify(message) )
    }
  }
}

function wsSendTask(task) {
  //console.log("wsSendTask")
  let m = { task: task };
  let processorId = m.task.newDestination;
  wsSendObject(processorId, m);
}

function initWebSocketServer(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    ws.data = { processorId: undefined };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      if (!j?.task?.ping) {
        //console.log("ws.on message", j)
      }

      if (j?.task) {
        const processorId = j.task.newSource;
        //console.log("processorId", processorId)
        if (ws.data["processorId"] !== processorId) {
          connections.set(processorId, ws);
          ws.data["processorId"] = processorId;
          //console.log("Websocket processorId", processorId)
        }
        let processors = [];
        if (j.task.sessionId) {
          const sessionsStoreId = j.task.sessionId + "_processors";
          if (await sessionsStore_async.has(sessionsStoreId)) {
            let currentProcessors = await sessionsStore_async.get(sessionsStoreId);
            if (currentProcessors && !currentProcessors.includes(processorId)) {
              console.log("Adding processor to session", processorId, currentProcessors)
              currentProcessors.push(processorId)
              await sessionsStore_async.set(sessionsStoreId, currentProcessors);
            }
            processors = currentProcessors;
          } else {
            // We should not be able to reach here?
            await sessionsStore_async.set(sessionsStoreId, [processorId]);
            processors = [processorId]
            console.log("Initial processor to session", processorId)
          }
        }

        // Need to know the processortemplate
        //activeProcessors
          
        // Forwarding messages from nodejs to react
        // Eventually we will not use newDestination (just sync tasks)
        // Use the sessionId to identify the react websockets
        // We do not have messages going from react to nodejs via websocket
        // This code needs to be generalized, later.
        if (!j?.task?.ping) {
          if (!processors) {
            throw new Error("No processors ", j.task);
          }
          if (j?.task?.newDestination?.startsWith("react")) {
            if (processors.length === 0) {
              throw new Error("No processors ", j.task);
            }
            for (const processorId of processors) {
              if (processorId.startsWith("react")) {
                const reactWs = connections.get(processorId);
                if (!reactWs) {
                  console.log("Lost websocket for react", processorId);
                } else {
                  console.log("Forwarding message to ", processorId)    
                  reactWs.send(message, { binary: false });
                }
              }
            }
          }
        }
        
      }

      if (j?.task?.ping) {
        const task = {
          pong: "ok", 
          sessionId: j.task?.sessionId, 
          newDestination: j.task.newSource,
        };
        wsSendTask(task);
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