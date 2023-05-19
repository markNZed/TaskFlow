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
    ws.send(JSON.stringify(message));
    //console.log("wsSendObject ", JSON.stringify(message) )
  }
}

function initWebSocketProxy(server) {
  const websocketServer = new WebSocketServer({ server: server, path: "/hub/ws" });

  const nodejsUrl = 'ws://localhost:5000/nodejs/ws';

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    let closing = false;

    // All we are doing is forwarding messages
    // Should reproduce ping/pong also
    const nodejsWs = new WebSocket(nodejsUrl);

    nodejsWs.on('message', function incoming(message) {
      // Just forwarding the message did not work
      // Need to set binary false to avoid sending as blob
      ws.send(message, { binary: false });
      
      // If we want to intercept:
      //const j = JSON.parse(message);
      //console.log('nodejsWs.on message', j)
      //ws.send(JSON.stringify(j));
      
    });

    nodejsWs.on("close", function (code, reason) {
      console.log("nodejsWs is closed with code: " + code + " reason: ", reason);
      if (!closing) {
        ws.close(code, reason);
      }
      closing = true;
    });

    let sessionId = undefined;
    ws.data = { sessionId: sessionId };

    ws.on("message", async (message) => {

      const j = JSON.parse(message);

      console.log("ws.on message", j)

      // just forwarding the message did work here
      nodejsWs.send(JSON.stringify(j));

      if (j?.sessionId) {
        sessionId = j.sessionId;
        if (ws.data["sessionId"] !== sessionId) {
          connections.set(sessionId, ws);
          ws.data["sessionId"] = sessionId;
          console.log("Websocket sessionId", sessionId)
          if (j?.task?.source) {
            ws.data["destination"] = j.task.source;
          } else {
            console.log("No task.source in message", j)
            ws.data["destination"] = "unknown";
          }
        }
      }

      if (j?.ping) {
        wsSendObject(sessionId, { pong: "ok" });
        console.log("Ponging", ws?.data)
      }
    });

    ws.on("close", function (code, reason) {
      console.log("ws sessionId " + ws.data.sessionId + " is closed with code: " + code + " reason: ", reason);
      connections.delete(sessionId);
      if (!closing) {
        nodejsWs.close(code, reason);
      }
      closing = true;
    });
  });
}

export { initWebSocketProxy, wsSendObject };
