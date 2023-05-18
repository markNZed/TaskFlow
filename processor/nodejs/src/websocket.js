/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from "ws";
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

function initWebSocketServer(server) {
  const websocketServer = new WebSocketServer({ server: server, path: "/nodejs/ws" });

  websocketServer.on("connection", (ws) => {
    console.log("websocketServer.on");

    let sessionId = undefined;
    ws.data = { sessionId: sessionId };

    ws.on("message", async (message) => {
      const j = JSON.parse(message);

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
        //console.log("Ponging", ws?.data)
      }
    });

    ws.on("close", function (code, reason) {
      console.log("ws sessionId " + ws.data.sessionId + " is closed with code: " + code + " reason: ", reason);
      connections.delete(sessionId);
    });
  });
}

export { initWebSocketServer, wsSendObject };
