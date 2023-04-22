/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocketServer } from 'ws';
import { connections } from './storage.mjs';

function wsSendObject(ws, message = {}) {
  if (!ws) {
    console.log("Lost websocket for wsSendObject");
  } else {
    ws.send(JSON.stringify(message));
    //console.log("wsSendObject ", message )
  }
}

function initWebSocketServer(server) {
  const websocketServer = new WebSocketServer({ server: server, path: '/ws' });

  websocketServer.on('connection', (ws) => {
    console.log("websocketServer.on");

    let sessionId = undefined;
    ws.data = { 'sessionId': sessionId };

    ws.on('message', async (message) => {
      const j = JSON.parse(message);

      if (j?.sessionId) {
        sessionId = j.sessionId;
        connections.set(sessionId, ws);
        ws.data['sessionId'] = sessionId;
      }

      if (j?.ping) {
        wsSendObject(ws, { "pong": "ok" });
      }
    });

    ws.on('close', function (code, reason) {
      console.log('ws is closed with code: ' + code + ' reason: ' + reason);
      connections.delete(sessionId);
    });
  });
}

export { initWebSocketServer, wsSendObject };
