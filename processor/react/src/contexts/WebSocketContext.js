/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect, useRef } from "react";
import { EventEmitter } from "events";
import useWebSocket from "react-use-websocket";
import useGlobalStateContext from "./GlobalStateContext";

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

  console.log("--------- WebSocketProvider ---------");

  const [webSocket, setWebSocket] = useState(null);
  const { globalState, replaceGlobalState } = useGlobalStateContext();
  const sendJsonMessagePlusRef = useRef();

  // The default is 10 but we have at least 3 listeners per task
  // There is also the listener for partial results
  // So this would allow for about 4 * 25 concurrent tasks
  webSocketEventEmitter.setMaxListeners(100);

  // update this useEffect, need to do this so sendJsonMessagePlus takes the updated value of globalState
  sendJsonMessagePlusRef.current = function (m) {
    m.task.processor["id"] = globalState.processorId;
    if (m.task?.processor?.command === "ping") {
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
        let currentDateTime = new Date();
        let currentDateTimeString = currentDateTime.toString();
        return {
          updatedeAt: currentDateTimeString,
          processor: {command: "ping"},
        }
      }
      sendJsonMessagePlusRef.current({task: taskPing()});
      const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          sendJsonMessagePlusRef.current({task: taskPing()});
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
      let command;
      let commandArgs;
      let sourceProcessorId;
      if (message?.task) {
        // The processor strips hub specific info because the Task Function should not interact with the Hub
        command = message.task.hub.command;
        commandArgs = message.task.hub?.commandArgs;
        sourceProcessorId = message.task.hub?.sourceProcessorId;
        delete message.task.hub;
      }
      if (command !== "pong") {
        //console.log("App webSocket command", command,  message.task.instanceId, message.task);
        //Could structure as messageQueue[command][messageQueueIdx]
        // Need to include this here because we have cleared message.task.command by here
        message.command = command;
        message.commandArgs = commandArgs;
        message.sourceProcessorId = sourceProcessorId;
        messageQueue[messageQueueIdx] = message;
        messageQueueIdx = messageQueueIdx + 1;
        // Could eventaully just emit the index
        webSocketEventEmitter.emit(command, message.task);
      } else if (command === "pong") {
        //console.log("App webSocket received pong", message);
      } else {
        console.log("App webSocket unexpected message", message);
      }
    },
    onClose: (e) => {
      console.log(
        `App webSocket closed with code ${e.code} and reason '${e.reason}' and error ${e}`
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
    },
    // This makes a huge improvement to performance because it disables the state update inside useWebSocket and avoids re-rendering
    filter: (message) => {
      return false
    },
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
