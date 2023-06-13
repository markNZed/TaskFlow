/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect, useRef } from "react";
import { EventEmitter } from "events";
import useWebSocket from "react-use-websocket";
import useGlobalStateContext from "./GlobalStateContext";

import { log, updatedAt } from "../utils/utils";

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

export const webSocketEventEmitter = new WebSocketEventEmitter();

export default function useWebSocketContext() {
  return useContext(WebSocketContext);
}

export let messageQueue = {};
export let messageQueueIdx = 0;

// Because useWebSocket includes state it will cause a re-render of 
// WebSocketProvider after each message is received
// This is not ideal but it is not clear how to avoid it
export function WebSocketProvider({ children, socketUrl }) {

  //console.log("--------- WebSocketProvider ---------");

  const [webSocket, setWebSocket] = useState(null);
  const { globalState, replaceGlobalState } = useGlobalStateContext();
  const sendJsonMessagePlusRef = useRef();

  // The default is 10 but we have at least 3 listeners per task
  // There is also the listener for partial results
  // So this would allow for about 4 * 25 concurrent tasks
  webSocketEventEmitter.setMaxListeners(100);

  // update this useEffect, need to do this so sendJsonMessagePlus takes the updated value of globalState
  sendJsonMessagePlusRef.current = function (m) {
    if (!m?.task) {
      m["task"] = {}
    }
    m.task.destination = globalState.hubId
    m.task.sessionId = globalState.sessionId
    m.task.source = globalState.processorId;
    if (m.command === "ping") {
      //console.log("Sending " + socketUrl + " " + JSON.stringify(m))
    }
    sendJsonMessage(m);
  };

  const { sendJsonMessage, getWebSocket } = useWebSocket(socketUrl, {
    reconnectAttempts: 15,
    //reconnectInterval: 500,
    //attemptNumber will be 0 the first time it attempts to reconnect, so this equation results in a reconnect pattern of 1 second, 2 seconds, 4 seconds, 8 seconds, and then caps at 10 seconds until the maximum number of attempts is reachedW
    reconnectInterval: (attemptNumber) =>
      Math.min(Math.pow(2, attemptNumber) * 1000, 10000),
    shouldReconnect: (closeEvent) => {
      return true;
    },
    onOpen: (e) => {
      console.log("App webSocket connection established.");
      let ws = getWebSocket();
      //setWebSocket(ws);
      if (!globalState.hubId) {
        // This should cause the App to re-register with the hub
        // Reassigning te same value will create an event 
        //replaceGlobalState("hubId", null);
      }
      const taskPing = () => {
        return {
          sessionId: globalState.sessionId,
          destination: globalState.hubId,
        }
      }
      sendJsonMessagePlusRef.current({task: taskPing(), command: "ping"});
      const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          sendJsonMessagePlusRef.current({task: taskPing(), command: "ping"});
        } else {
          // WebSocket is not open, clear the interval
          clearInterval(intervalId);
        }
      }, 30 * 1000); // 30 seconds
      ws.pingIntervalId = intervalId;
    },
    onMessage: (e) => {
      if (e.data instanceof Blob) {
        console.log("e.data is a Blob");
        return
      }
      //console.log("App webSocket message received:", e);
      // Should be in try/catch block
      const message = JSON.parse(e.data);
      if (message?.command && message.command !== "pong") {
        //console.log("App webSocket command", message.command,  message.task.instanceId, message.task);
        //Could strcuture as messageQueue[message.command][messageQueueIdx]
        if (message.command === "update") {
          messageQueue[messageQueueIdx] = message;
          messageQueueIdx = messageQueueIdx + 1;
        }
        // Could eventaully just emit the index
        webSocketEventEmitter.emit(message?.command, message.task);
      } else if (message.command === "pong") {
        //console.log("App webSocket received pong", message);
      } else {
        console.log("App webSocket unexpected message", message);
      }
    },
    onClose: (e) => {
      console.log(
        `App webSocket closed with code ${e.code} and reason '${e.reason}'`
      );
      let ws = getWebSocket();
      if (ws.pingIntervalId) {
        clearInterval(ws.pingIntervalId);
      }
      // This should cause the App to re-register with the hub
      //replaceGlobalState("hubId", null);
    },
    onerror: (e) => {
      console.log("App webSocket closed with error", e);
    }
  });

  /*
  const connectionStatus = webSocket
    ? {
        [WebSocket.CONNECTING]: "Connecting",
        [WebSocket.OPEN]: "Open",
        [WebSocket.CLOSING]: "Closing",
        [WebSocket.CLOSED]: "Closed",
      }[webSocket.readyState]
    : "Uninstantiated";
  */

  return (
    <WebSocketContext.Provider
      value={{ 
        //connectionStatus, 
        //webSocketEventEmitter, 
        //sendJsonMessagePlus: (...args) => sendJsonMessagePlusRef.current(...args),
        //messageQueue,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
