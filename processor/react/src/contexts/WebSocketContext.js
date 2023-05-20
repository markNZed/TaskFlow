/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect, useRef } from "react";
import { EventEmitter } from "events";
import useWebSocket from "react-use-websocket";
import { useGlobalStateContext } from "./GlobalStateContext";
import { hubSocketUrl } from "../config";

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

export const webSocketEventEmitter = new WebSocketEventEmitter();

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children, socketUrl }) {

  const [webSocket, setWebSocket] = useState(null);
  const { globalState } = useGlobalStateContext();

  const sendJsonMessagePlusRef = useRef(); // add this line

  // update this useEffect, need to do this so sendJsonMessagePlus takes the updated value of globalState
  useEffect(() => {
    sendJsonMessagePlusRef.current = function (m) {
      console.log("Sending " + socketUrl + " " + JSON.stringify(m))
      if (!m?.task) {
        m["task"] = {}
      }
      m.task.destination = socketUrl
      m.task.sessionId = globalState?.sessionId
      m.task.source = "react"
      sendJsonMessage(m);
    };
  }, [globalState]);

  const { sendJsonMessage, getWebSocket } = useWebSocket(hubSocketUrl, {
    reconnectAttempts: 10,
    reconnectInterval: 500,
    shouldReconnect: (closeEvent) => {
      return true;
    },
    onOpen: (e) => {
      console.log("App webSocket connection established.");
      let ws = getWebSocket();
      setWebSocket(ws);
      sendJsonMessagePlusRef.current({ sessionId: globalState?.sessionId, ping: "ok" });
      const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          sendJsonMessagePlusRef.current({ sessionId: globalState?.sessionId, ping: "ok" });
        } else {
          // WebSocket is not open, clear the interval
          clearInterval(intervalId);
        }
      }, 30 * 1000); // 30 seconds
      ws.pingIntervalId = intervalId;
    },
    onMessage: (e) => {
      webSocketEventEmitter.emit("message", e);
    },
    onClose: (e) => {
      console.log(
        `App webSocket closed with code ${e.code} and reason '${e.reason}'`
      );
      let ws = getWebSocket();
      if (ws.pingIntervalId) {
        clearInterval(ws.pingIntervalId);
      }
    },
    onerror: (e) => {
      console.log("App webSocket closed with error", e);
    }
  });

  const connectionStatus = webSocket
    ? {
        [WebSocket.CONNECTING]: "Connecting",
        [WebSocket.OPEN]: "Open",
        [WebSocket.CLOSING]: "Closing",
        [WebSocket.CLOSED]: "Closed",
      }[webSocket.readyState]
    : "Uninstantiated";

  return (
    <WebSocketContext.Provider
      value={{ 
        connectionStatus, 
        webSocketEventEmitter, 
        sendJsonMessagePlus: (...args) => sendJsonMessagePlusRef.current(...args),
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
