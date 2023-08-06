/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect, useRef } from "react";
import { EventEmitter } from "events";
import useWebSocket from "react-use-websocket";
import useGlobalStateContext from "./GlobalStateContext";
import { utils } from "../utils/utils";

class WebSocketEventEmitter extends EventEmitter {}

const WebSocketContext = React.createContext();

export const webSocketEventEmitter = new WebSocketEventEmitter();

export default function useWebSocketContext() {
  return useContext(WebSocketContext);
}

export let messageQueue = {};
export let messageQueueIdx = 0;

export function WebSocketProvider({ children, socketUrl }) {

  console.log("--------- WebSocketProvider ---------");

  const { globalState } = useGlobalStateContext();
  const sendJsonMessagePlusRef = useRef();

  // The default is 10 but we have at least 3 listeners per task
  // There is also the listener for partial results
  // So this would allow for about 4 * 25 concurrent tasks
  webSocketEventEmitter.setMaxListeners(100);

  // update this useEffect, need to do this so sendJsonMessagePlus takes the updated value of globalState
  sendJsonMessagePlusRef.current = function (m) {
    if (m.task?.processor?.command !== "ping") {
      console.log("sendJsonMessagePlusRef ", m.task);
      //console.log("Sending " + socketUrl + " " + JSON.stringify(m))
    }
    sendJsonMessage(m);
  };

  const wsSendTask = async function (task) {
    //console.log("wsSendTask " + message)
    let message = {}; 
    task = utils.taskInProcessorOut(task, globalState.processorId);
    // Next want to send the diff considering the latest task storage state
    if (task.instanceId) {
      const lastTask = await globalState.storageRef.current.get(task.instanceId);
      task = utils.ProcessorInProcessorOut(lastTask, task);
    }
    if (globalState.user) {
      task.user = {"id": globalState.user.userId};
    }
    message["task"] = task;
    sendJsonMessagePlusRef.current(message);
  }

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
      if (!globalState.hubId) {
        // This should cause the App to re-register with the hub
        // Reassigning the same value will create an event 
        //replaceGlobalState("hubId", null);
      }
      wsSendTask(utils.taskPing());
      const intervalId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          wsSendTask(utils.taskPing());
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
      let task;
      if (message?.task) {
        task = utils.hubInProcessorOut(message.task);
        command = task.processor.command;
        commandArgs = task.processor.commandArgs;
      }
      if (command !== "pong") {
        //console.log("App webSocket command", command,  commandArgs, message.task.id, message.task);
        //Could structure as messageQueue[command][messageQueueIdx]
        // Need to include this here because we have cleared message.task.command by here
        message.command = command;
        message.commandArgs = commandArgs;
        messageQueue[messageQueueIdx] = message;
        messageQueueIdx = messageQueueIdx + 1;
        // Could eventaully just emit the index
        webSocketEventEmitter.emit(command, task);
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
        wsSendTask,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
