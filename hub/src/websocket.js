/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer, WebSocket } from "ws";
import { connections } from "./storage.mjs";

function wsSendObject(sessionId, message = {}) {
  let ws = connections.get(sessionId);
  if (!ws) {
    console.log("Lost websocket for wsSendObject", sessionId, message);
  } else {
    if (!message?.task) {
      message["task"] = {}
    }
    // The destination is availalbe because nodejs does not initiate webscoket connections
    message.task.destination = ws.data.destination;
    message.task.sessionId = sessionId;
    ws.send(JSON.stringify(message));
    //console.log("wsSendObject ", JSON.stringify(message) )
  }
}

function wsSendTask(message) {
  console.log("wsSendTask")
  wsSendObject(message.task.sessionId, message);
}

const processorConnections = new Map(); // Could merge into connections?

function initWebSocketProxy(server) {

  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    let closing = false;

    let sessionId = undefined;
    ws.data = { sessionId: sessionId };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      console.log("ws.on message", j)

      if (j?.sessionId) {
        sessionId = j.sessionId;
        if (ws.data["sessionId"] !== sessionId) {
          connections.set(sessionId, ws);
          ws.data["sessionId"] = sessionId;
          console.log("Websocket sessionId", sessionId)
          if (j?.task?.destination) {
            ws.data["destination"] = j.task.destination;
            const processorUrl = j.task.destination

            let processorWs = processorConnections.get(sessionId + processorUrl);
            if (!processorWs || processorWs.readyState !== WebSocket.OPEN) {
              console.log("Creating processorWs for " + processorUrl)
              processorWs = new WebSocket(processorUrl);
              processorConnections.set(sessionId + processorUrl, processorWs);

              processorWs.on('message', function incoming(message) {
                // Just forwarding the message did not work
                // Need to set binary false to avoid sending as blob
                //console.log("processorWs.on message", message)
                ws.send(message, { binary: false });
              });

              processorWs.on("close", function (code, reason) {
                console.log("processorWs is closed with code: " + code + " reason: ", reason);
                processorConnections.delete(sessionId + processorUrl);
                if (!closing) {
                  ws.close(code, reason);
                }
                closing = true;
              });

              processorWs.on('error', function(error) {
                console.error("Websocket error: ", error);
                connections.delete(sessionId + processorUrl);
              });
            }
          } else {
            console.log("No task.destination in message", j)
            ws.data["destination"] = "unknown";
          }
        }
      }

      if (j?.ping) {
        wsSendObject(sessionId, { pong: "ok" });
        console.log("Pong " + sessionId)
      }

      // Forward the message to the node.js server
      const processorWs = processorConnections.get(sessionId + ws.data["destination"]);
      if (processorWs && processorWs.readyState === WebSocket.OPEN) {
        processorWs.send(JSON.stringify(j));
      }
    });

    ws.on("close", function (code, reason) {
      console.log("ws sessionId " + ws.data.sessionId + " is closed with code: " + code + " reason: ", reason);
      connections.delete(sessionId);
      if (!closing) {
        const processorWs = processorConnections.get(sessionId + ws.data["destination"]);
        if (processorWs && processorWs.readyState === WebSocket.OPEN) {
          processorWs.close(code, reason);
        }
      }
      processorConnections.delete(sessionId + ws.data["destination"]);
      closing = true;
    });

    ws.on('error', function(error) {
      console.error("Websocket error: ", error);
      if (ws.data.sessionId) {
        connections.delete(ws.data.sessionId);
      }
    });

  });
};

export { initWebSocketProxy, wsSendObject, wsSendTask };
