/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { WebSocket } from "ws";
import { hubSocketUrl, processorId } from "./../config.mjs";
import register_async from "./register.mjs";
import { activeTasksStore_async } from "./storage.mjs";

// The reconnection logic should be reworked if an error genrates a close event

let connectionAttempts = 0;
let maxAttempts = 15;
let processorWs;

function wsSendObject(message = {}) {
  if (!processorWs) {
    console.log("Lost websocket for wsSendObject", message);
  } else {
    if (!message?.task) {
      message["task"] = {}
    }
    if (!message.task?.sessionId && !message.task?.ping) {
      console.log("Missing sessionId");
    }
    // This is just a hack, should be automated by hub
    if (!message.task?.newDestination) {
      message.task.newDestination = "react";
    }
    message.task.source = "nodejs";
    message.task.newSource = processorId;
    processorWs.send(JSON.stringify(message));
    if (!message.task?.ping) {
      console.log("wsSendObject ", JSON.stringify(message) )
    }
  }
}

function wsSendTask(message) {
  //console.log("wsSendTask " + message)
  wsSendObject(message);
}

const connectWebSocket = () => {
  processorWs = new WebSocket(hubSocketUrl);

  processorWs.onopen = () => {
    console.log("processorWs.onOpen");
    processorWs.data = {};
    processorWs.data["didStart"] = true;
    register_async();
    // reset connection attempts on successful connection
    connectionAttempts = 0;
    const taskPing = () => {
      let currentDateTime = new Date();
      let currentDateTimeString = currentDateTime.toString();
      return {
        ping: currentDateTimeString,
        newDestination: "hub",
      }
    }
    wsSendTask({task: taskPing()});
    const intervalId = setInterval(() => {
      if (processorWs.readyState === WebSocket.OPEN) {
        wsSendTask({task: taskPing()});
      } else {
        clearInterval(intervalId);
      }
    }, 30 * 1000);
    processorWs.pingIntervalId = intervalId;
  }

  processorWs.onmessage = async (e) => {
    if (e.data instanceof Blob) {
      console.log("e.data is a Blob");
      return
    }
    const message = JSON.parse(e.data);
    if (message?.command === "update") {
      console.log("ws updating activeTasksStore_async")
      await activeTasksStore_async.set(message.task.instanceId, message.task)
      //processActiveTasks_async(task)
    } else if (message?.task?.ping) {
      //console.log("ws ping received", message)
    } else {
      console.log("Unexpected message", message)
    }
  };

  processorWs.onclose = function (event) {
    console.log("processorWs sessionId is closed with code: " + event.code);
    // attempt reconnection with backoff on close
    if (processorWs?.data?.didStart) {
      if (connectionAttempts < maxAttempts) {
        let backoffTime = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
        let currentDateTime = new Date();
        let currentDateTimeString = currentDateTime.toString();
        console.log(`Attempting onclose reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
        setTimeout(connectWebSocket, backoffTime);
        connectionAttempts++;
      } else {
        console.log("Max onclose reconnection attempts reached.");
      }
    }
  };

  processorWs.onerror = function(error) {
    console.error("Websocket error: ", error.message);
    // attempt reconnection with backoff on error
    if (connectionAttempts < maxAttempts) {
      let backoffTime = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
      let currentDateTime = new Date();
      let currentDateTimeString = currentDateTime.toString();
      console.log(`Attempting onerror reconnection ${connectionAttempts} in ${backoffTime}ms from ${currentDateTimeString}`);
      setTimeout(connectWebSocket, backoffTime);
      connectionAttempts++;
    } else {
      console.log("Max onerror reconnection attempts reached.");
    }
  };
}

connectWebSocket();

export { wsSendTask, wsSendObject };
