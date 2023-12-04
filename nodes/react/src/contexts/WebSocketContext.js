/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useRef } from "react";
import { EventEmitter } from "events";
import useWebSocket from "react-use-websocket";
import useGlobalStateContext from "./GlobalStateContext";
import { utils } from "../utils/utils.mjs";
import Cookies from 'js-cookie';

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

  const logPingPong = false;

  const { globalState } = useGlobalStateContext();
  const sendJsonMessagePlusRef = useRef();
  // To get a cookie
  const authToken = Cookies.get('authToken');

  // The default is 10 but we have at least 3 listeners per task
  // There is also the listener for partial results
  // So this would allow for about 4 * 25 concurrent tasks
  webSocketEventEmitter.setMaxListeners(100);

  function pingSocketReload(socketUrl, retryCount = 0, maxRetries = 5, retryDelay = 1000) {
    const socket = new WebSocket(socketUrl);
    socket.onopen = function(event) {
        console.log("Connection established with the WebSocket server.");
        // If the connection is successful, reload the window
        // This should cause the App to re-register with the hub
        window.location.reload(true);
    };
    socket.onerror = function(error) {
        console.log("Failed to connect with the WebSocket server: ", error);
        retryCount++;
        if (retryCount <= maxRetries) {
            // Calculate exponential backoff time
            const backoffTime = retryDelay * Math.pow(2, retryCount - 1);
            console.log(`Retrying connection in ${backoffTime} ms`);
            setTimeout(() => pingSocketReload(socketUrl, retryCount, maxRetries, retryDelay), backoffTime);
        } else {
            console.log("Max retries reached. Not attempting further connections.");
        }
    };
    socket.onclose = function(event) {
        console.log("Connection with the WebSocket server closed.");
        // Handle the closure of the connection if necessary
    };
  }

  // update this useEffect, need to do this so sendJsonMessagePlus takes the updated value of globalState
  sendJsonMessagePlusRef.current = function (m) {
    if (m.task?.node?.command !== "ping") {
      console.log("sendJsonMessagePlusRef ", m.task?.meta?.messageId);
      //console.log("Sending " + socketUrl + " " + JSON.stringify(m))
    }
    if (m.task?.node?.command === "ping" && logPingPong) {
      console.log("Ping");
    }
    sendJsonMessage(m);
  };

  const wsSendTask = async function (task) {
    //console.log("wsSendTask " + message)
    let message = {}; 
    task = await utils.taskToNode_async(task, globalState.nodeId, globalState?.storageRef?.current.get);
    if (globalState.user) {
      task.user = {"id": globalState.user.id};
    }
    task.meta = task.meta || {};
    task.meta.prevMessageId = task.meta.messageId;
    task.meta.messageId = utils.nanoid8();
    task.tokens = task.tokens || {};
    task.tokens["authToken"] = authToken;
    message["task"] = task;
    utils.debugTask(task);
    sendJsonMessagePlusRef.current(message);
  }

  const { sendJsonMessage, getWebSocket } = useWebSocket(socketUrl, {
    reconnectAttempts: 5,
    //reconnectInterval: 500,
    //attemptNumber will be 0 the first time it attempts to reconnect, so this equation results in a reconnect pattern of 1 second, 2 seconds, 4 seconds, 8 seconds, and then caps at 10 seconds until the maximum number of attempts is reachedW
    reconnectInterval: (attemptNumber) => {
      Math.min(Math.pow(2, attemptNumber) * 1000, 10000);
    },

    shouldReconnect: (closeEvent) => {
      return true;
    },

    onOpen: (e) => {
      console.log("App webSocket connection established.");
      let ws = getWebSocket();
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
        utils.debugTask(message.task, "received on websocket");
        task = message.task;
        command = task.node.command;
        commandArgs = task.node.commandArgs;
      }
      if (command !== "pong") {
        //console.log("App webSocket command:", command, "commandArgs:", commandArgs, "task:", message.task);
        if (command !== "partial") {
          console.log("App webSocket (except pong & partial) command:", command);
          //console.log("App webSocket (except pong & partial) command:", command, "commandDescription:", task.node.commandDescription, "commandArgs:", commandArgs, "state:", task?.state?.current, "task:", utils.deepClone(task));
        }
        //Could structure as messageQueue[command][messageQueueIdx]
        // Need to include this here because we have cleared message.task.command by here
        message.command = command;
        message.commandArgs = commandArgs;
        messageQueue[messageQueueIdx] = message;
        messageQueueIdx = messageQueueIdx + 1;
        window.messageQueue = messageQueue;
        window.messageQueueIdx = messageQueueIdx;
        // Could eventaully just emit the index
        webSocketEventEmitter.emit(command, task);
      } else if (command === "pong") {
        logPingPong && console.log("Pong");
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
    },

    onerror: (e) => {
      console.log("App webSocket closed with error", e);
    },

    onReconnectStop: (e) => {
      pingSocketReload(socketUrl);
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
