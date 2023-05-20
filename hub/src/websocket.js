/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
import { connections } from "./storage.mjs";

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
    ws.send(JSON.stringify(message));
    console.log("wsSendObject ", JSON.stringify(message) )
  }
}

function wsSendTask(message) {
  const processorId = message.task?.sessionId + message.task.newDestination;
  //console.log("wsSendTask")
  wsSendObject(processorId, message);
}

function initWebSocketProxy(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    ws.data = { processorId: undefined };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      if (!j?.task?.ping) {
        console.log("ws.on message", j)
      }

      if (j?.task) {
        const processorId = j.task.sessionId + j.task.source;
        console.log("processorId", processorId)
        if (ws.data["processorId"] !== processorId) {
          connections.set(processorId, ws);
          ws.data["processorId"] = processorId;
          console.log("Websocket processorId", processorId)
        }
          
        // Forwarding messages from nodejs to react
        if (j?.task?.newDestination === "react") {
          const reactWs = connections.get(j.task.sessionId + "react");
          if (!reactWs) {
            console.log("Lost websocket for react", j.task.sessionId + "react");
          }
          reactWs.send(message, { binary: false });
        }
      }

      if (j?.task?.ping) {
        wsSendTask({task: {pong: "ok", sessionId: j.task?.sessionId, newDestination: j.task.source}});
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

export { initWebSocketProxy, wsSendObject, wsSendTask };
